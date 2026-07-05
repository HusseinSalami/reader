/**
 * Tests for Finalize Submission Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './finalize-submission';

vi.mock('../layers/shared/nodejs/submission-management-service', () => ({
  SubmissionManagementService: vi.fn(() => ({
    finalizeSubmission: vi.fn()
  }))
}));

describe('finalize-submission handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (
    submissionId: string = 'sub-123',
    customerId: string = 'customer-123'
  ): Partial<APIGatewayProxyEvent> => ({
    pathParameters: { submissionId },
    requestContext: {
      authorizer: { customerId }
    } as any
  });

  describe('Request Validation', () => {
    it('should return 401 if customer ID is missing', async () => {
      const event = {
        pathParameters: { submissionId: 'sub-123' },
        requestContext: {} as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toContain('Unauthorized');
    });

    it('should return 400 if submissionId is missing', async () => {
      const event = {
        pathParameters: {},
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        } as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('submissionId');
    });
  });

  describe('Successful Finalization', () => {
    it('should finalize submission', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockFinalizeSubmission = vi.fn().mockResolvedValue(undefined);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        finalizeSubmission: mockFinalizeSubmission
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('finalized successfully');
      expect(body.submissionId).toBe('sub-123');
      expect(body.finalizedAt).toBeDefined();
      expect(new Date(body.finalizedAt).getTime()).toBeGreaterThan(0);
      expect(mockFinalizeSubmission).toHaveBeenCalledWith('sub-123', 'customer-123');
    });

    it('should include timestamp in response', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockFinalizeSubmission = vi.fn().mockResolvedValue(undefined);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        finalizeSubmission: mockFinalizeSubmission
      }));

      const beforeTime = new Date().toISOString();
      const event = createMockEvent();
      const result = await handler(event as APIGatewayProxyEvent);
      const afterTime = new Date().toISOString();

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.finalizedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(body.finalizedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 if submission not found', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockFinalizeSubmission = vi.fn().mockRejectedValue(
        new Error('Submission sub-123 not found for customer customer-123')
      );
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        finalizeSubmission: mockFinalizeSubmission
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toContain('not found');
    });

    it('should return 500 for other errors', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockFinalizeSubmission = vi.fn().mockRejectedValue(new Error('Database error'));
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        finalizeSubmission: mockFinalizeSubmission
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toContain('Failed to finalize submission');
    });

    it('should handle conditional check failures gracefully', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockFinalizeSubmission = vi.fn().mockRejectedValue(
        new Error('ConditionalCheckFailedException')
      );
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        finalizeSubmission: mockFinalizeSubmission
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toContain('Failed to finalize submission');
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should enforce customer ID in finalization', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockFinalizeSubmission = vi.fn().mockResolvedValue(undefined);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        finalizeSubmission: mockFinalizeSubmission
      }));

      const event = createMockEvent('sub-123', 'customer-456');

      await handler(event as APIGatewayProxyEvent);

      expect(mockFinalizeSubmission).toHaveBeenCalledWith('sub-123', 'customer-456');
    });
  });
});
