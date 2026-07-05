/**
 * Tests for List Submissions Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './list-submissions';

// Set environment variables for tests
process.env.SUBMISSIONS_TABLE_NAME = 'test-submissions-table';

vi.mock('../layers/shared/nodejs/submission-management-service', () => ({
  SubmissionManagementService: vi.fn(() => ({
    listSubmissions: vi.fn()
  }))
}));

describe('list-submissions handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (
    examId: string = 'exam-123',
    customerId: string = 'customer-123'
  ): Partial<APIGatewayProxyEvent> => ({
    pathParameters: { examId },
    requestContext: {
      authorizer: { customerId }
    } as any
  });

  describe('Request Validation', () => {
    it('should return 401 if customer ID is missing', async () => {
      const event = {
        pathParameters: { examId: 'exam-123' },
        requestContext: {} as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toContain('Unauthorized');
    });

    it('should return 400 if examId is missing', async () => {
      const event = {
        pathParameters: {},
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        } as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('examId');
    });
  });

  describe('Successful Listing', () => {
    it('should return list of submissions', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockSubmissions = [
        {
          submissionId: 'sub-1',
          examId: 'exam-123',
          customerId: 'customer-123',
          studentId: 'student-1',
          studentName: 'Alice Smith',
          submittedAt: '2024-01-01T00:00:00Z',
          status: 'GRADED',
          manualOverrides: [],
          isFinalized: false
        },
        {
          submissionId: 'sub-2',
          examId: 'exam-123',
          customerId: 'customer-123',
          studentId: 'student-2',
          studentName: 'Bob Jones',
          submittedAt: '2024-01-01T00:01:00Z',
          status: 'PROCESSING',
          manualOverrides: [],
          isFinalized: false
        }
      ];
      
      const mockListSubmissions = vi.fn().mockResolvedValue(mockSubmissions);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        listSubmissions: mockListSubmissions
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.examId).toBe('exam-123');
      expect(body.count).toBe(2);
      expect(body.submissions).toHaveLength(2);
      expect(body.submissions[0].studentName).toBe('Alice Smith');
      expect(body.submissions[1].studentName).toBe('Bob Jones');
      expect(mockListSubmissions).toHaveBeenCalledWith('exam-123', 'customer-123');
    });

    it('should return empty list if no submissions exist', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockListSubmissions = vi.fn().mockResolvedValue([]);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        listSubmissions: mockListSubmissions
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.count).toBe(0);
      expect(body.submissions).toEqual([]);
    });

    it('should include grading results in submissions', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockSubmissions = [
        {
          submissionId: 'sub-1',
          examId: 'exam-123',
          customerId: 'customer-123',
          studentId: 'student-1',
          studentName: 'Alice Smith',
          submittedAt: '2024-01-01T00:00:00Z',
          status: 'GRADED',
          gradingResult: {
            submissionId: 'sub-1',
            studentId: 'student-1',
            examId: 'exam-123',
            decisions: [],
            totalScore: 85,
            maxScore: 100,
            averageConfidence: 90,
            gradedAt: '2024-01-01T00:05:00Z',
            costTracking: {
              textractPages: 1,
              textractCost: 0.015,
              bedrockTokensInput: 500,
              bedrockTokensOutput: 100,
              bedrockCost: 0.002,
              totalCost: 0.017
            }
          },
          manualOverrides: [],
          isFinalized: false
        }
      ];
      
      const mockListSubmissions = vi.fn().mockResolvedValue(mockSubmissions);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        listSubmissions: mockListSubmissions
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.submissions[0].gradingResult).toBeDefined();
      expect(body.submissions[0].gradingResult.totalScore).toBe(85);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 if listing fails', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockListSubmissions = vi.fn().mockRejectedValue(new Error('Database error'));
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        listSubmissions: mockListSubmissions
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toContain('Failed to list submissions');
    });
  });
});
