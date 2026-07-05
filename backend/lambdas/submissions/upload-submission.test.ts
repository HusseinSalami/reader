/**
 * Tests for Single Submission Upload Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './upload-submission';

// Set environment variables for tests
process.env.SUBMISSIONS_TABLE_NAME = 'test-submissions-table';
process.env.EXAMS_TABLE_NAME = 'test-exams-table';
process.env.BUCKET_NAME = 'test-bucket';
process.env.PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn(() => ({
    send: vi.fn()
  })),
  SendMessageCommand: vi.fn()
}));

vi.mock('../layers/shared/nodejs/submission-management-service', () => ({
  SubmissionManagementService: vi.fn(() => ({
    createSubmission: vi.fn()
  }))
}));

describe('upload-submission handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GRADING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/grading-queue';
  });

  const createMockEvent = (
    body: any,
    examId: string = 'exam-123',
    customerId: string = 'customer-123'
  ): Partial<APIGatewayProxyEvent> => ({
    body: JSON.stringify(body),
    pathParameters: { examId },
    requestContext: {
      authorizer: { customerId }
    } as any
  });

  describe('Request Validation', () => {
    it('should return 401 if customer ID is missing', async () => {
      const event = {
        body: JSON.stringify({}),
        pathParameters: { examId: 'exam-123' },
        requestContext: {} as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toContain('Unauthorized');
    });

    it('should return 400 if examId is missing', async () => {
      const event = {
        body: JSON.stringify({}),
        pathParameters: {},
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        } as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('examId');
    });

    it('should return 400 if request body is missing', async () => {
      const event = {
        body: null,
        pathParameters: { examId: 'exam-123' },
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        } as any
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('request body');
    });

    it('should return 400 if studentId is missing', async () => {
      const event = createMockEvent({
        studentName: 'Alice Smith',
        documentUrl: 's3://bucket/alice.pdf'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Student ID is required');
    });

    it('should return 400 if studentName is missing', async () => {
      const event = createMockEvent({
        studentId: 'student-1',
        documentUrl: 's3://bucket/alice.pdf'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Student name is required');
    });

    it('should return 400 if documentUrl is missing', async () => {
      const event = createMockEvent({
        studentId: 'student-1',
        studentName: 'Alice Smith'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Document URL is required');
    });

    it('should return 400 if studentId is empty string', async () => {
      const event = createMockEvent({
        studentId: '   ',
        studentName: 'Alice Smith',
        documentUrl: 's3://bucket/alice.pdf'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Student ID is required');
    });
  });

  describe('Successful Upload', () => {
    beforeEach(() => {
      // Ensure QUEUE_URL is set for successful upload tests
      process.env.GRADING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/grading-queue';
    });

    it('should create submission and queue for processing', async () => {
      const { SQSClient, SendMessageCommand } = await import('@aws-sdk/client-sqs');
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockSend = vi.fn().mockResolvedValue({});
      (SQSClient as any).mockImplementation(() => ({
        send: mockSend
      }));
      
      const mockCreateSubmission = vi.fn().mockResolvedValue({
        submissionId: 'sub-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        studentId: 'student-1',
        studentName: 'Alice Smith',
        submittedAt: '2024-01-01T00:00:00Z',
        status: 'UPLOADED',
        manualOverrides: [],
        isFinalized: false
      });
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        createSubmission: mockCreateSubmission
      }));

      const event = createMockEvent({
        studentId: 'student-1',
        studentName: 'Alice Smith',
        documentUrl: 's3://bucket/alice.pdf'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('uploaded successfully');
      expect(body.submission).toBeDefined();
      expect(body.submission.submissionId).toBe('sub-123');
      expect(mockCreateSubmission).toHaveBeenCalledWith(
        {
          examId: 'exam-123',
          studentId: 'student-1',
          studentName: 'Alice Smith',
          documentUrl: 's3://bucket/alice.pdf'
        },
        'customer-123'
      );
      expect(mockSend).toHaveBeenCalled();
    });

    it('should include correct message attributes in SQS message', async () => {
      const { SQSClient, SendMessageCommand } = await import('@aws-sdk/client-sqs');
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockSend = vi.fn().mockResolvedValue({});
      let capturedCommand: any = null;
      
      (SQSClient as any).mockImplementation(() => ({
        send: (command: any) => {
          capturedCommand = command;
          return mockSend(command);
        }
      }));
      
      const mockCreateSubmission = vi.fn().mockResolvedValue({
        submissionId: 'sub-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        studentId: 'student-1',
        studentName: 'Alice Smith',
        submittedAt: '2024-01-01T00:00:00Z',
        status: 'UPLOADED',
        manualOverrides: [],
        isFinalized: false
      });
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        createSubmission: mockCreateSubmission
      }));

      const event = createMockEvent({
        studentId: 'student-1',
        studentName: 'Alice Smith',
        documentUrl: 's3://bucket/alice.pdf'
      });

      await handler(event as APIGatewayProxyEvent);

      expect(capturedCommand).toBeDefined();
      expect(capturedCommand.input.MessageAttributes).toBeDefined();
      expect(capturedCommand.input.MessageAttributes.examId.StringValue).toBe('exam-123');
      expect(capturedCommand.input.MessageAttributes.customerId.StringValue).toBe('customer-123');
      expect(capturedCommand.input.MessageAttributes.submissionId.StringValue).toBe('sub-123');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 if queue URL is not configured', async () => {
      delete process.env.GRADING_QUEUE_URL;

      const event = createMockEvent({
        studentId: 'student-1',
        studentName: 'Alice Smith',
        documentUrl: 's3://bucket/alice.pdf'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toContain('configuration error');
    });

    it('should return 500 if submission creation fails', async () => {
      process.env.GRADING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/grading-queue';
      
      const { SubmissionManagementService } = await import('../layers/shared/nodejs/submission-management-service');
      
      const mockCreateSubmission = vi.fn().mockRejectedValue(new Error('Database error'));
      
      (SubmissionManagementService as any).mockImplementation(() => ({
        createSubmission: mockCreateSubmission
      }));

      const event = createMockEvent({
        studentId: 'student-1',
        studentName: 'Alice Smith',
        documentUrl: 's3://bucket/alice.pdf'
      });

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toContain('Failed to upload submission');
    });
  });
});
