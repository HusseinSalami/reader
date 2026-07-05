/**
 * Unit tests for batch submission upload handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

// Mock the handler module
const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

// Set environment variables
process.env.EXAMS_TABLE_NAME = 'TestExamsTable';
process.env.GRADING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';

describe('Batch Upload Handler', () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    vi.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should reject request without customer ID', async () => {
      const { handler } = await import('./batch-upload');
      
      const event = {
        requestContext: {
          authorizer: {}
        },
        body: JSON.stringify({
          examId: 'exam-123',
          submissions: []
        })
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toContain('Unauthorized');
    });

    it('should reject request without body', async () => {
      const { handler } = await import('./batch-upload');
      
      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        }
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Missing request body');
    });

    it('should reject request without examId', async () => {
      const { handler } = await import('./batch-upload');
      
      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          submissions: []
        })
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('examId');
    });

    it('should reject request with empty submissions array', async () => {
      const { handler } = await import('./batch-upload');
      
      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          examId: 'exam-123',
          submissions: []
        })
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('empty submissions');
    });

    it('should reject submission without studentId', async () => {
      const { handler } = await import('./batch-upload');
      
      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          examId: 'exam-123',
          submissions: [
            {
              studentName: 'John Doe',
              documentUrl: 's3://bucket/doc.pdf'
            }
          ]
        })
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('studentId');
    });

    it('should reject submission without studentName', async () => {
      const { handler } = await import('./batch-upload');
      
      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          examId: 'exam-123',
          submissions: [
            {
              studentId: 'student-123',
              documentUrl: 's3://bucket/doc.pdf'
            }
          ]
        })
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('studentName');
    });

    it('should reject submission without documentUrl', async () => {
      const { handler } = await import('./batch-upload');
      
      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          examId: 'exam-123',
          submissions: [
            {
              studentId: 'student-123',
              studentName: 'John Doe'
            }
          ]
        })
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('documentUrl');
    });
  });

  describe('Successful Batch Upload', () => {
    it('should accept valid batch upload and queue submissions', async () => {
      const { handler } = await import('./batch-upload');
      
      dynamoMock.on(PutCommand).resolves({});
      sqsMock.on(SendMessageCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          examId: 'exam-123',
          submissions: [
            {
              studentId: 'student-1',
              studentName: 'Alice Smith',
              documentUrl: 's3://bucket/alice.pdf'
            },
            {
              studentId: 'student-2',
              studentName: 'Bob Jones',
              documentUrl: 's3://bucket/bob.pdf'
            }
          ]
        })
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(202);
      
      const body = JSON.parse(result.body);
      expect(body.batchId).toBeDefined();
      expect(body.queuedCount).toBe(2);
      expect(body.failedCount).toBe(0);
      expect(body.status.totalSubmissions).toBe(2);
      expect(body.status.submissions).toHaveLength(2);
      
      // Verify DynamoDB was called to store batch record
      expect(dynamoMock.calls()).toHaveLength(1);
      
      // Verify SQS was called for each submission
      expect(sqsMock.calls()).toHaveLength(2);
    });

    it('should create batch record with correct structure', async () => {
      const { handler } = await import('./batch-upload');
      
      dynamoMock.on(PutCommand).resolves({});
      sqsMock.on(SendMessageCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          examId: 'exam-456',
          submissions: [
            {
              studentId: 'student-1',
              studentName: 'Alice Smith',
              documentUrl: 's3://bucket/alice.pdf'
            }
          ]
        })
      } as any;

      await handler(event);

      const putCalls = dynamoMock.commandCalls(PutCommand);
      expect(putCalls).toHaveLength(1);
      
      const batchRecord = putCalls[0].args[0].input.Item;
      expect(batchRecord.PK).toBe('CUSTOMER#customer-123');
      expect(batchRecord.SK).toMatch(/^BATCH#/);
      expect(batchRecord.examId).toBe('exam-456');
      expect(batchRecord.customerId).toBe('customer-123');
      expect(batchRecord.totalSubmissions).toBe(1);
      expect(batchRecord.status).toBe('QUEUED');
      expect(batchRecord.GSI1PK).toBe('EXAM#exam-456');
    });

    it('should send SQS messages with correct structure', async () => {
      const { handler } = await import('./batch-upload');
      
      dynamoMock.on(PutCommand).resolves({});
      sqsMock.on(SendMessageCommand).resolves({});

      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          examId: 'exam-789',
          submissions: [
            {
              studentId: 'student-1',
              studentName: 'Alice Smith',
              documentUrl: 's3://bucket/alice.pdf'
            }
          ]
        })
      } as any;

      await handler(event);

      const sqsCalls = sqsMock.commandCalls(SendMessageCommand);
      expect(sqsCalls).toHaveLength(1);
      
      const message = JSON.parse(sqsCalls[0].args[0].input.MessageBody);
      expect(message.examId).toBe('exam-789');
      expect(message.customerId).toBe('customer-123');
      expect(message.studentId).toBe('student-1');
      expect(message.studentName).toBe('Alice Smith');
      expect(message.documentUrl).toBe('s3://bucket/alice.pdf');
      expect(message.submissionId).toBeDefined();
      expect(message.batchId).toBeDefined();
    });
  });

  describe('Partial Failures', () => {
    it('should handle SQS queue failures gracefully', async () => {
      const { handler } = await import('./batch-upload');
      
      dynamoMock.on(PutCommand).resolves({});
      
      // First message succeeds, second fails
      sqsMock.on(SendMessageCommand)
        .resolvesOnce({})
        .rejectsOnce(new Error('Queue unavailable'));

      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          examId: 'exam-123',
          submissions: [
            {
              studentId: 'student-1',
              studentName: 'Alice Smith',
              documentUrl: 's3://bucket/alice.pdf'
            },
            {
              studentId: 'student-2',
              studentName: 'Bob Jones',
              documentUrl: 's3://bucket/bob.pdf'
            }
          ]
        })
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(202);
      
      const body = JSON.parse(result.body);
      expect(body.queuedCount).toBe(1);
      expect(body.failedCount).toBe(1);
      
      // Should have updated batch record with failed submission
      const updateCalls = dynamoMock.commandCalls(PutCommand);
      expect(updateCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors', async () => {
      const { handler } = await import('./batch-upload');
      
      dynamoMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      const event = {
        requestContext: {
          authorizer: { customerId: 'customer-123' }
        },
        body: JSON.stringify({
          examId: 'exam-123',
          submissions: [
            {
              studentId: 'student-1',
              studentName: 'Alice Smith',
              documentUrl: 's3://bucket/alice.pdf'
            }
          ]
        })
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBeDefined();
    });
  });
});
