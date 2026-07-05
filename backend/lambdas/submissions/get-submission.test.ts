/**
 * Tests for Get Submission Details Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './get-submission';

// Set environment variables for tests
process.env.SUBMISSIONS_TABLE_NAME = 'test-submissions-table';

vi.mock('../layers/shared/nodejs/submission-management-service', () => ({
  SubmissionManagementService: vi.fn(() => ({
    getSubmission: vi.fn()
  }))
}));

describe('get-submission handler', () => {
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

  describe('Successful Retrieval', () => {
    it('should return submission details', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockSubmission = {
        submissionId: 'sub-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        studentId: 'student-1',
        studentName: 'Alice Smith',
        submittedAt: '2024-01-01T00:00:00Z',
        status: 'GRADED',
        gradingResult: {
          submissionId: 'sub-123',
          studentId: 'student-1',
          examId: 'exam-123',
          decisions: [
            {
              questionNumber: '1',
              marksAwarded: 8,
              maxMarks: 10,
              confidence: 85,
              explanation: 'Good answer',
              isPartialCredit: false,
              requiresReview: false
            }
          ],
          totalScore: 8,
          maxScore: 10,
          averageConfidence: 85,
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
      };
      
      const mockGetSubmission = vi.fn().mockResolvedValue(mockSubmission);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        getSubmission: mockGetSubmission
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.submissionId).toBe('sub-123');
      expect(body.studentName).toBe('Alice Smith');
      expect(body.gradingResult).toBeDefined();
      expect(mockGetSubmission).toHaveBeenCalledWith('sub-123', 'customer-123');
    });

    it('should return submission with manual overrides', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockSubmission = {
        submissionId: 'sub-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        studentId: 'student-1',
        studentName: 'Alice Smith',
        submittedAt: '2024-01-01T00:00:00Z',
        status: 'FINALIZED',
        manualOverrides: [
          {
            questionNumber: '1',
            originalMarks: 8,
            overriddenMarks: 9,
            reason: 'Partial credit for creative approach',
            reviewedBy: 'teacher-1',
            reviewedAt: '2024-01-01T00:10:00Z'
          }
        ],
        isFinalized: true
      };
      
      const mockGetSubmission = vi.fn().mockResolvedValue(mockSubmission);
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        getSubmission: mockGetSubmission
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.manualOverrides).toHaveLength(1);
      expect(body.manualOverrides[0].overriddenMarks).toBe(9);
      expect(body.isFinalized).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 if submission not found', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockGetSubmission = vi.fn().mockRejectedValue(
        new Error('Submission sub-123 not found for customer customer-123')
      );
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        getSubmission: mockGetSubmission
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toContain('not found');
    });

    it('should return 500 for other errors', async () => {
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockGetSubmission = vi.fn().mockRejectedValue(new Error('Database error'));
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        getSubmission: mockGetSubmission
      }));

      const event = createMockEvent();

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toContain('Failed to get submission');
    });
  });
});
