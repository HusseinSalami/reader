/**
 * Tests for Get Exam Lambda Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './get-exam';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';
import { Exam } from '../layers/shared/nodejs/exam-types';

// Mock the ExamManagementService
vi.mock('../layers/shared/nodejs/exam-management-service');

describe('Get Exam Lambda Handler', () => {
  let mockGetExam: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExam = vi.fn();
    (ExamManagementService as any).mockImplementation(() => ({
      getExam: mockGetExam
    }));
  });
  
  const createMockEvent = (examId: string | null, customerId?: string): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: `/exams/${examId}`,
    pathParameters: examId ? { examId } : null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: customerId ? { customerId } : undefined,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      identity: {} as any,
      path: `/exams/${examId}`,
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/exams/{examId}'
    },
    resource: '/exams/{examId}'
  });
  
  describe('Successful exam retrieval', () => {
    it('should retrieve exam by ID', async () => {
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
        status: 'ACTIVE',
        submissionCount: 5,
        totalCost: 12.50
      };
      
      mockGetExam.mockResolvedValue(mockExam);
      
      const event = createMockEvent('exam-123', 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
      expect(mockGetExam).toHaveBeenCalledWith('exam-123', 'customer-1');
    });
  });
  
  describe('Validation errors', () => {
    it('should return 401 when customer ID is missing', async () => {
      const event = createMockEvent('exam-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(401);
      expect(mockGetExam).not.toHaveBeenCalled();
    });
    
    it('should return 400 when exam ID is missing', async () => {
      const event = createMockEvent(null, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(mockGetExam).not.toHaveBeenCalled();
    });
  });
  
  describe('Error handling', () => {
    it('should return 404 when exam not found', async () => {
      mockGetExam.mockRejectedValue(new Error('Exam exam-999 not found for customer customer-1'));
      
      const event = createMockEvent('exam-999', 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(404);
    });
    
    it('should return 500 for unexpected errors', async () => {
      mockGetExam.mockRejectedValue(new Error('Database connection failed'));
      
      const event = createMockEvent('exam-123', 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(500);
    });
  });
});
