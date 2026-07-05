/**
 * Tests for Create Exam Lambda Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './create-exam';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';
import { Exam } from '../layers/shared/nodejs/exam-types';

// Mock the ExamManagementService
vi.mock('../layers/shared/nodejs/exam-management-service');

describe('Create Exam Lambda Handler', () => {
  let mockCreateExam: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateExam = vi.fn();
    (ExamManagementService as any).mockImplementation(() => ({
      createExam: mockCreateExam
    }));
  });
  
  const createMockEvent = (body: any, customerId?: string): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/exams',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: customerId ? { customerId } : undefined,
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      identity: {} as any,
      path: '/exams',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/exams'
    },
    resource: '/exams'
  });
  
  describe('Successful exam creation', () => {
    it('should create exam with valid input', async () => {
      const mockExam: Exam = {
        examId: 'exam-123',
        customerId: 'customer-1',
        teacherId: 'teacher-1',
        title: 'Math Final Exam',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        questionnaire: {
          sections: [],
          totalQuestions: 0,
          extractionConfidence: 0
        },
        answerKey: [],
        status: 'DRAFT',
        submissionCount: 0,
        totalCost: 0
      };
      
      mockCreateExam.mockResolvedValue(mockExam);
      
      const event = createMockEvent({
        title: 'Math Final Exam',
        teacherId: 'teacher-1',
        questionnaireUrl: 's3://bucket/questionnaire.pdf',
        answerKeyUrl: 's3://bucket/answer-key.pdf'
      }, 'customer-1');
      
      const result = await handler(event);
      
      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body)).toEqual({
        success: true,
        data: mockExam
      });
      expect(mockCreateExam).toHaveBeenCalledWith(
        {
          title: 'Math Final Exam',
          teacherId: 'teacher-1',
          questionnaireUrl: 's3://bucket/questionnaire.pdf',
          answerKeyUrl: 's3://bucket/answer-key.pdf'
        },
        'customer-1'
      );
    });
  });
  
  describe('Validation errors', () => {
    it('should return 401 when customer ID is missing', async () => {
      const event = createMockEvent({
        title: 'Math Final Exam',
        teacherId: 'teacher-1',
        questionnaireUrl: 's3://bucket/questionnaire.pdf',
        answerKeyUrl: 's3://bucket/answer-key.pdf'
      });
      
      const result = await handler(event);
      
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Customer ID not found in authorization context'
        }
      });
      expect(mockCreateExam).not.toHaveBeenCalled();
    });
    
    it('should return 400 when request body is missing', async () => {
      const event = createMockEvent(null, 'customer-1');
      event.body = null;
      
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body is required'
        }
      });
      expect(mockCreateExam).not.toHaveBeenCalled();
    });
    
    it('should return 400 when title is missing', async () => {
      const event = createMockEvent({
        teacherId: 'teacher-1',
        questionnaireUrl: 's3://bucket/questionnaire.pdf',
        answerKeyUrl: 's3://bucket/answer-key.pdf'
      }, 'customer-1');
      
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.code).toBe('VALIDATION_ERROR');
    });
    
    it('should return 400 when questionnaireUrl is missing', async () => {
      const event = createMockEvent({
        title: 'Math Final Exam',
        teacherId: 'teacher-1',
        answerKeyUrl: 's3://bucket/answer-key.pdf'
      }, 'customer-1');
      
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.code).toBe('VALIDATION_ERROR');
    });
  });
  
  describe('Error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockCreateExam.mockRejectedValue(new Error('Database connection failed'));
      
      const event = createMockEvent({
        title: 'Math Final Exam',
        teacherId: 'teacher-1',
        questionnaireUrl: 's3://bucket/questionnaire.pdf',
        answerKeyUrl: 's3://bucket/answer-key.pdf'
      }, 'customer-1');
      
      const result = await handler(event);
      
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error.code).toBe('INTERNAL_ERROR');
    });
  });
});
