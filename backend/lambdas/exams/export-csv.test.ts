/**
 * Tests for CSV Export Handler
 * 
 * Tests the GET /exams/:examId/export/csv endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { ExportResult, Exam } from '../layers/shared/nodejs/exam-types';

// Hoist mock functions so they're available during module initialization
const { mockExportToCSV, mockGetExam } = vi.hoisted(() => ({
  mockExportToCSV: vi.fn(),
  mockGetExam: vi.fn()
}));

// Mock the services before importing the handler
vi.mock('../layers/shared/nodejs/export-service', () => ({
  ExportService: vi.fn(() => ({
    exportToCSV: vi.fn(),
    exportToCSV: mockExportToCSV
  }))
}));

vi.mock('../layers/shared/nodejs/exam-management-service', () => ({
  ExamManagementService: vi.fn(() => ({
    getExam: mockGetExam,
    createExam: vi.fn(),
    listExams: vi.fn(),
    updateExamQuestions: vi.fn(),
    deleteExam: vi.fn()
  }))
}));

// Import handler after mocks are set up
import { handler } from './export-csv';

describe('Export CSV Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  const createEvent = (
    examId: string,
    customerId: string = 'customer-123'
  ): APIGatewayProxyEvent => ({
    httpMethod: 'GET',
    path: `/exams/${examId}/export/csv`,
    pathParameters: { examId },
    requestContext: {
      authorizer: { customerId }
    } as any,
    headers: {},
    body: null,
    isBase64Encoded: false,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: ''
  });
  
  describe('Successful Export', () => {
    it('should generate CSV export and return pre-signed URL', async () => {
      const examId = 'exam-123';
      const customerId = 'customer-123';
      
      const mockExam: Partial<Exam> = {
        examId,
        customerId,
        title: 'Test Exam'
      };
      
      const mockExportResult: ExportResult = {
        exportId: 'export-456',
        downloadUrl: 'https://s3.amazonaws.com/bucket/export-456.csv?signature=abc',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        format: 'EXCEL',
        recordCount: 30
      };
      
      mockGetExam.mockResolvedValue(mockExam as Exam);
      mockExportToCSV.mockResolvedValue(mockExportResult);
      
      const event = createEvent(examId, customerId);
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      expect(mockGetExam).toHaveBeenCalledWith(examId, customerId);
      expect(mockExportToCSV).toHaveBeenCalledWith(examId, customerId);
      
      const body = JSON.parse(result.body);
      expect(body.message).toBe('CSV export generated successfully');
      expect(body.export).toEqual(mockExportResult);
      expect(body.export.downloadUrl).toContain('.csv');
      expect(body.export.format).toBe('EXCEL');
    });
    
    it('should include record count in response', async () => {
      const examId = 'exam-123';
      const customerId = 'customer-123';
      
      mockGetExam.mockResolvedValue({ examId, customerId } as Exam);
      mockExportToCSV.mockResolvedValue({
        exportId: 'export-456',
        downloadUrl: 'https://s3.amazonaws.com/bucket/export-456.csv',
        expiresAt: new Date().toISOString(),
        format: 'EXCEL',
        recordCount: 75
      });
      
      const event = createEvent(examId, customerId);
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.export.recordCount).toBe(75);
    });
    
    it('should include expiration time in response', async () => {
      const examId = 'exam-123';
      const customerId = 'customer-123';
      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      
      mockGetExam.mockResolvedValue({ examId, customerId } as Exam);
      mockExportToCSV.mockResolvedValue({
        exportId: 'export-456',
        downloadUrl: 'https://s3.amazonaws.com/bucket/export-456.csv',
        expiresAt,
        format: 'EXCEL',
        recordCount: 15
      });
      
      const event = createEvent(examId, customerId);
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.export.expiresAt).toBe(expiresAt);
    });
  });
  
  describe('Validation', () => {
    it('should return 401 when customer ID is missing', async () => {
      const event = createEvent('exam-123', '');
      event.requestContext.authorizer = undefined;
      
      const result = await handler(event);
      
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Unauthorized');
      expect(mockExportToCSV).not.toHaveBeenCalled();
    });
    
    it('should return 400 when examId is missing', async () => {
      const event = createEvent('exam-123');
      event.pathParameters = null;
      
      const result = await handler(event);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Missing examId');
      expect(mockExportToCSV).not.toHaveBeenCalled();
    });
  });
  
  describe('Multi-Tenant Isolation', () => {
    it('should verify exam belongs to customer before exporting', async () => {
      const examId = 'exam-123';
      const customerId = 'customer-123';
      
      mockGetExam.mockResolvedValue({ examId, customerId } as Exam);
      mockExportToCSV.mockResolvedValue({
        exportId: 'export-456',
        downloadUrl: 'https://s3.amazonaws.com/bucket/export-456.csv',
        expiresAt: new Date().toISOString(),
        format: 'EXCEL',
        recordCount: 20
      });
      
      const event = createEvent(examId, customerId);
      await handler(event);
      
      expect(mockGetExam).toHaveBeenCalledWith(examId, customerId);
    });
    
    it('should return 404 when exam does not exist', async () => {
      const examId = 'nonexistent-exam';
      const customerId = 'customer-123';
      
      mockGetExam.mockRejectedValue(new Error('Exam not found'));
      
      const event = createEvent(examId, customerId);
      const result = await handler(event);
      
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('not found');
      expect(mockExportToCSV).not.toHaveBeenCalled();
    });
    
    it('should return 404 when exam belongs to different customer', async () => {
      const examId = 'exam-123';
      const customerId = 'customer-123';
      
      // Exam service will throw error when exam doesn't belong to customer
      mockGetExam.mockRejectedValue(new Error('Exam not found'));
      
      const event = createEvent(examId, customerId);
      const result = await handler(event);
      
      expect(result.statusCode).toBe(404);
      expect(mockExportToCSV).not.toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should return 500 when export service fails', async () => {
      const examId = 'exam-123';
      const customerId = 'customer-123';
      
      mockGetExam.mockResolvedValue({ examId, customerId } as Exam);
      mockExportToCSV.mockRejectedValue(new Error('CSV generation failed'));
      
      const event = createEvent(examId, customerId);
      const result = await handler(event);
      
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Failed to generate CSV export');
      expect(body.message).toContain('CSV generation failed');
    });
    
    it('should handle unexpected errors gracefully', async () => {
      const examId = 'exam-123';
      const customerId = 'customer-123';
      
      mockGetExam.mockRejectedValue(new Error('Database connection failed'));
      
      const event = createEvent(examId, customerId);
      const result = await handler(event);
      
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
    });
  });
  
  describe('CORS Headers', () => {
    it('should include CORS headers in successful response', async () => {
      const examId = 'exam-123';
      const customerId = 'customer-123';
      
      mockGetExam.mockResolvedValue({ examId, customerId } as Exam);
      mockExportToCSV.mockResolvedValue({
        exportId: 'export-456',
        downloadUrl: 'https://s3.amazonaws.com/bucket/export-456.csv',
        expiresAt: new Date().toISOString(),
        format: 'EXCEL',
        recordCount: 20
      });
      
      const event = createEvent(examId, customerId);
      const result = await handler(event);
      
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });
    
    it('should include CORS headers in error response', async () => {
      const event = createEvent('exam-123');
      event.pathParameters = null;
      
      const result = await handler(event);
      
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    });
  });
  
  describe('Format Verification', () => {
    it('should return EXCEL format in export result', async () => {
      const examId = 'exam-123';
      const customerId = 'customer-123';
      
      mockGetExam.mockResolvedValue({ examId, customerId } as Exam);
      mockExportToCSV.mockResolvedValue({
        exportId: 'export-456',
        downloadUrl: 'https://s3.amazonaws.com/bucket/export-456.csv',
        expiresAt: new Date().toISOString(),
        format: 'EXCEL',
        recordCount: 20
      });
      
      const event = createEvent(examId, customerId);
      const result = await handler(event);
      
      const body = JSON.parse(result.body);
      expect(body.export.format).toBe('EXCEL');
    });
  });
});
