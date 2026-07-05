/**
 * Tests for Update Exam Questions Lambda Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './update-questions';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';
import { Question } from '../layers/shared/nodejs/exam-types';

// Mock the ExamManagementService
vi.mock('../layers/shared/nodejs/exam-management-service');

describe('Update Exam Questions Lambda Handler', () => {
  let mockUpdateExamQuestions: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateExamQuestions = vi.fn();
    (ExamManagementService as any).mockImplementation(() => ({
      updateExamQuestions: mockUpdateExamQuestions
    }));
  });
  
  const createMockEvent = (
    examId: string | null,
    body: any,
    customerId?: string
  ): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'PUT',
    isBase64Encoded: false,
    path: `/exams/${examId}/questions`,
    pathParameters: examId ? { examId } : null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: customerId ? { customerId } : undefined,
      protocol: 'HTTP/1.1',
      httpMethod: 'PUT',
      identity: {} as any,
      path: `/exams/${examId}/questions`,
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/exams/{examId}/questions'
    },
    resource: '/exams/{examId}/questions'
  });
  
  const validQuestions: Question[] = [
    {
      questionNumber: '1',
      questionText: 'Solve for x: 2x + 5 = 15',
      points: 10,
      sectionId: 'section-1'
    },
    {
      questionNumber: '2',
      questionText: 'What is the derivative of x^2?',
      points: 5,
      sectionId: 'section-1'
    }
  ];
  
  describe('Successful question update', () => {
    it('should update exam questions with valid input', async () => {
      mockUpdateExamQuestions.mockResolvedValue(undefined);
      
      const event = createMockEvent('exam-123', { questions: validQuestions }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
      expect(mockUpdateExamQuestions).toHaveBeenCalledWith('exam-123', validQuestions, 'customer-1');
    });
  });
  
  describe('Validation errors', () => {
    it('should return 401 when customer ID is missing', async () => {
      const event = createMockEvent('exam-123', { questions: validQuestions });
      const result = await handler(event);
      
      expect(result.statusCode).toBe(401);
      expect(mockUpdateExamQuestions).not.toHaveBeenCalled();
    });
    
    it('should return 400 when exam ID is missing', async () => {
      const event = createMockEvent(null, { questions: validQuestions }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(mockUpdateExamQuestions).not.toHaveBeenCalled();
    });
    
    it('should return 400 when questions is not an array', async () => {
      const event = createMockEvent('exam-123', { questions: 'not-an-array' }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(mockUpdateExamQuestions).not.toHaveBeenCalled();
    });
    
    it('should return 400 when question is missing required fields', async () => {
      const invalidQuestions = [
        {
          questionText: 'Solve for x',
          points: 10,
          sectionId: 'section-1'
        }
      ];
      
      const event = createMockEvent('exam-123', { questions: invalidQuestions }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(mockUpdateExamQuestions).not.toHaveBeenCalled();
    });
    
    it('should return 400 when points is negative', async () => {
      const invalidQuestions = [
        {
          questionNumber: '1',
          questionText: 'Solve for x',
          points: -5,
          sectionId: 'section-1'
        }
      ];
      
      const event = createMockEvent('exam-123', { questions: invalidQuestions }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(mockUpdateExamQuestions).not.toHaveBeenCalled();
    });
  });
  
  describe('Error handling', () => {
    it('should return 404 when exam not found', async () => {
      mockUpdateExamQuestions.mockRejectedValue(new Error('Exam exam-999 not found'));
      
      const event = createMockEvent('exam-999', { questions: validQuestions }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(404);
    });
    
    it('should return 500 for unexpected errors', async () => {
      mockUpdateExamQuestions.mockRejectedValue(new Error('Database connection failed'));
      
      const event = createMockEvent('exam-123', { questions: validQuestions }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(500);
    });
  });
});
