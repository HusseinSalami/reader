/**
 * Tests for Update Grade Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './update-grade';

// Set environment variables for tests
process.env.SUBMISSIONS_TABLE_NAME = 'test-submissions-table';

vi.mock('../layers/shared/nodejs/submission-management-service', () => ({
  SubmissionManagementService: vi.fn(() => ({
    updateGrade: vi.fn()
  }))
}));

describe('update-grade handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (
    body: any,
    submissionId: string = 'sub-123',
    questionNumber: string = '1',
    customerId: string = 'customer-123',
    userId: string = 'teacher-1'
  ): Partial<APIGatewayProxyEvent> => ({
    body: JSON.stringify(body),
    pathParameters: { submissionId, questionNumber },
    requestContext: {
      authorizer: { customerId, userId }
    } as any
  });

  describe('Request Validation', () => {
    it('should return 401 if customer ID is missing', async () => {
      const event = {
        body: JSON.stringify({}),
        pathParameters: { submissionId: 'sub-123', questionNumber: '1' },
        requestContext: {} as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toContain('Unauthorized');
    });

    it('should return 400 if submissionId is missing', async () => {
      const event = {
        body: JSON.stringify({}),
        pathParameters: { questionNumber: '1' },
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        } as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('submissionId');
    });

    it('should return 400 if questionNumber is missing', async () => {
      const event = {
        body: JSON.stringify({}),
        pathParameters: { submissionId: 'sub-123' },
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        } as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('questionNumber');
    });

    it('should return 400 if request body is missing', async () => {
      const event = {
        body: null,
        pathParameters: { submissionId: 'sub-123', questionNumber: '1' },
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        } as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('request body');
    });

    it('should return 400 if originalMarks is missing', async () => {
      const event = createMockEvent({
        overriddenMarks: 9,
        reason: 'Good work'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('originalMarks');
    });

    it('should return 400 if overriddenMarks is missing', async () => {
      const event = createMockEvent({
        originalMarks: 8,
        reason: 'Good work'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('overriddenMarks');
    });

    it('should return 400 if reason is missing', async () => {
      const event = createMockEvent({
        originalMarks: 8,
        overriddenMarks: 9
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('reason is required');
    });

    it('should return 400 if reason is empty string', async () => {
      const event = createMockEvent({
        originalMarks: 8,
        overriddenMarks: 9,
        reason: '   '
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('reason is required');
    });

    it('should return 400 if originalMarks is negative', async () => {
      const event = createMockEvent({
        originalMarks: -1,
        overriddenMarks: 9,
        reason: 'Good work'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('non-negative');
    });

    it('should return 400 if overriddenMarks is negative', async () => {
      const event = createMockEvent({
        originalMarks: 8,
        overriddenMarks: -1,
        reason: 'Good work'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('non-negative');
    });
  });

  describe('Successful Grade Update', () => {
    it('should update grade with manual override', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockUpdateGrade = vi.fn().mockResolvedValue(undefined);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        updateGrade: mockUpdateGrade
      }));

      const event = createMockEvent({
        originalMarks: 8,
        overriddenMarks: 9,
        reason: 'Partial credit for creative approach'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('updated successfully');
      expect(body.submissionId).toBe('sub-123');
      expect(body.questionNumber).toBe('1');
      expect(body.manualGrade).toBeDefined();
      expect(body.manualGrade.overriddenMarks).toBe(9);
      expect(body.manualGrade.reviewedBy).toBe('teacher-1');
      expect(mockUpdateGrade).toHaveBeenCalledWith(
        'sub-123',
        '1',
        expect.objectContaining({
          questionNumber: '1',
          originalMarks: 8,
          overriddenMarks: 9,
          reason: 'Partial credit for creative approach',
          reviewedBy: 'teacher-1'
        }),
        'customer-123'
      );
    });

    it('should include timestamp in manual grade', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockUpdateGrade = vi.fn().mockResolvedValue(undefined);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        updateGrade: mockUpdateGrade
      }));

      const event = createMockEvent({
        originalMarks: 8,
        overriddenMarks: 9,
        reason: 'Good work'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.manualGrade.reviewedAt).toBeDefined();
      expect(new Date(body.manualGrade.reviewedAt).getTime()).toBeGreaterThan(0);
    });

    it('should use unknown as reviewedBy if userId is missing', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockUpdateGrade = vi.fn().mockResolvedValue(undefined);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        updateGrade: mockUpdateGrade
      }));

      const event = {
        body: JSON.stringify({
          originalMarks: 8,
          overriddenMarks: 9,
          reason: 'Good work'
        }),
        pathParameters: { submissionId: 'sub-123', questionNumber: '1' },
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        } as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.manualGrade.reviewedBy).toBe('unknown');
    });
  });

  describe('Error Handling', () => {
    it('should return 400 if submission not found', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockUpdateGrade = vi.fn().mockRejectedValue(
        new Error('Submission sub-123 not found for customer customer-123')
      );
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        updateGrade: mockUpdateGrade
      }));

      const event = createMockEvent({
        originalMarks: 8,
        overriddenMarks: 9,
        reason: 'Good work'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Invalid request');
    });

    it('should return 500 for other errors', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockUpdateGrade = vi.fn().mockRejectedValue(new Error('Database error'));
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        updateGrade: mockUpdateGrade
      }));

      const event = createMockEvent({
        originalMarks: 8,
        overriddenMarks: 9,
        reason: 'Good work'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toContain('Failed to update grade');
    });
  });
});
