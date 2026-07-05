/**
 * Tests for List Exams Lambda Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './list-exams';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';
import { Exam } from '../layers/shared/nodejs/exam-types';

// Mock the ExamManagementService
vi.mock('../layers/shared/nodejs/exam-management-service');

describe('List Exams Lambda Handler', () => {
  let mockListExams: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockListExams = vi.fn();
    (ExamManagementService as any).mockImplementation(() => ({
      listExams: mockListExams
    }));
  });
  
  const createMockEvent = (
    queryParams: Record<string, string> | null,
    customerId?: string
  ): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/exams',
    pathParameters: null,
    queryStringParameters: queryParams,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: customerId ? { customerId } : undefined,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
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
  
  const mockExam1: Exam = {
    examId: 'exam-1',
    customerId: 'customer-1',
    teacherId: 'teacher-1',
    title: 'Math Final Exam',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    questionnaire: { sections: [], totalQuestions: 0, extractionConfidence: 0 },
    answerKey: [],
    status: 'ACTIVE',
    submissionCount: 5,
    totalCost: 12.50
  };
  
  const mockExam2: Exam = {
    examId: 'exam-2',
    customerId: 'customer-1',
    teacherId: 'teacher-2',
    title: 'Science Midterm',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    questionnaire: { sections: [], totalQuestions: 0, extractionConfidence: 0 },
    answerKey: [],
    status: 'DRAFT',
    submissionCount: 0,
    totalCost: 0
  };
  
  describe('Successful exam listing', () => {
    it('should list all exams without filters', async () => {
      mockListExams.mockResolvedValue([mockExam1, mockExam2]);
      
      const event = createMockEvent(null, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(2);
      expect(mockListExams).toHaveBeenCalledWith('customer-1', {});
    });
    
    it('should filter exams by status', async () => {
      mockListExams.mockResolvedValue([mockExam1]);
      
      const event = createMockEvent({ status: 'ACTIVE' }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      expect(mockListExams).toHaveBeenCalledWith('customer-1', { status: 'ACTIVE' });
    });
    
    it('should filter exams by teacherId', async () => {
      mockListExams.mockResolvedValue([mockExam1]);
      
      const event = createMockEvent({ teacherId: 'teacher-1' }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      expect(mockListExams).toHaveBeenCalledWith('customer-1', { teacherId: 'teacher-1' });
    });
  });
  
  describe('Validation errors', () => {
    it('should return 401 when customer ID is missing', async () => {
      const event = createMockEvent(null);
      const result = await handler(event);
      
      expect(result.statusCode).toBe(401);
      expect(mockListExams).not.toHaveBeenCalled();
    });
    
    it('should return 400 for invalid status value', async () => {
      const event = createMockEvent({ status: 'INVALID_STATUS' }, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(mockListExams).not.toHaveBeenCalled();
    });
  });
  
  describe('Error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockListExams.mockRejectedValue(new Error('Database connection failed'));
      
      const event = createMockEvent(null, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(500);
    });
  });
});
