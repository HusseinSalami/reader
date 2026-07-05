/**
 * Tests for Delete Exam Lambda Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './delete-exam';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';

// Mock the ExamManagementService
vi.mock('../layers/shared/nodejs/exam-management-service');

describe('Delete Exam Lambda Handler', () => {
  let mockDeleteExam: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteExam = vi.fn();
    (ExamManagementService as any).mockImplementation(() => ({
      deleteExam: mockDeleteExam
    }));
  });
  
  const createMockEvent = (examId: string | null, customerId?: string): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'DELETE',
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
      httpMethod: 'DELETE',
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
  
  describe('Successful exam deletion', () => {
    it('should delete exam by ID', async () => {
      mockDeleteExam.mockResolvedValue(undefined);
      
      const event = createMockEvent('exam-123', 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
      expect(mockDeleteExam).toHaveBeenCalledWith('exam-123', 'customer-1');
    });
  });
  
  describe('Validation errors', () => {
    it('should return 401 when customer ID is missing', async () => {
      const event = createMockEvent('exam-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(401);
      expect(mockDeleteExam).not.toHaveBeenCalled();
    });
    
    it('should return 400 when exam ID is missing', async () => {
      const event = createMockEvent(null, 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      expect(mockDeleteExam).not.toHaveBeenCalled();
    });
  });
  
  describe('Error handling', () => {
    it('should return 404 when exam not found', async () => {
      mockDeleteExam.mockRejectedValue(new Error('Exam exam-999 not found for customer customer-1'));
      
      const event = createMockEvent('exam-999', 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(404);
    });
    
    it('should return 403 when access is denied', async () => {
      mockDeleteExam.mockRejectedValue(new Error('Access denied: Customer mismatch'));
      
      const event = createMockEvent('exam-123', 'customer-2');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(403);
    });
    
    it('should return 500 for unexpected errors', async () => {
      mockDeleteExam.mockRejectedValue(new Error('Database connection failed'));
      
      const event = createMockEvent('exam-123', 'customer-1');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(500);
    });
  });
});
