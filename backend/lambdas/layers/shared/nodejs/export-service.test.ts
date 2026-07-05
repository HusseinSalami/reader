/**
 * Unit tests for ExportService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from './export-service';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SubmissionRecord } from './exam-types';

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('@aws-sdk/lib-dynamodb');
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner');

describe('ExportService', () => {
  let exportService: ExportService;
  let mockDocClientSend: any;
  let mockS3ClientSend: any;
  
  const mockCustomerId = 'customer-123';
  const mockExamId = 'exam-456';
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDocClientSend = vi.fn();
    mockS3ClientSend = vi.fn();
    
    vi.mocked(DynamoDBDocumentClient.from).mockReturnValue({
      send: mockDocClientSend
    } as any);
    
    vi.mocked(S3Client).mockImplementation(() => ({
      send: mockS3ClientSend
    } as any));
    
    vi.mocked(getSignedUrl).mockResolvedValue('https://s3.amazonaws.com/signed-url');
    
    exportService = new ExportService();
  });
  
  it('should export to CSV successfully', async () => {
    const mockSubmissions: SubmissionRecord[] = [{
      PK: `EXAM#${mockExamId}`,
      SK: 'SUBMISSION#sub-1',
      submissionId: 'sub-1',
      examId: mockExamId,
      customerId: mockCustomerId,
      studentId: 'student-1',
      studentName: 'Alice Smith',
      submittedAt: '2024-01-01T10:00:00Z',
      status: 'GRADED',
      documentS3Key: 'doc1.pdf',
      pageCount: 5,
      gradingDecisions: [{
        questionNumber: '1',
        marksAwarded: 8,
        maxMarks: 10,
        confidence: 85.5,
        explanation: 'Good answer',
        isPartialCredit: true,
        requiresReview: false
      }],
      totalScore: 8,
      maxScore: 10,
      manualOverrides: [],
      isFinalized: true,
      GSI1PK: `CUSTOMER#${mockCustomerId}`,
      GSI1SK: 'SUBMISSION#2024-01-01T10:00:00Z',
      GSI2PK: 'STUDENT#student-1',
      GSI2SK: 'SUBMISSION#2024-01-01T10:00:00Z'
    }];
    
    mockDocClientSend.mockResolvedValueOnce({ Items: mockSubmissions });
    mockS3ClientSend.mockResolvedValueOnce({});
    
    const result = await exportService.exportToCSV(mockExamId, mockCustomerId);
    
    expect(result.format).toBe('CSV');
    expect(result.recordCount).toBe(1);
    expect(result.downloadUrl).toBeDefined();
  });
  
  it('should export to Excel successfully', async () => {
    const mockSubmissions: SubmissionRecord[] = [{
      PK: `EXAM#${mockExamId}`,
      SK: 'SUBMISSION#sub-1',
      submissionId: 'sub-1',
      examId: mockExamId,
      customerId: mockCustomerId,
      studentId: 'student-1',
      studentName: 'Bob Jones',
      submittedAt: '2024-01-01T10:00:00Z',
      status: 'GRADED',
      documentS3Key: 'doc1.pdf',
      pageCount: 3,
      gradingDecisions: [{
        questionNumber: '1',
        marksAwarded: 9,
        maxMarks: 10,
        confidence: 88.5,
        explanation: 'Excellent',
        isPartialCredit: true,
        requiresReview: false
      }],
      totalScore: 9,
      maxScore: 10,
      manualOverrides: [],
      isFinalized: true,
      GSI1PK: `CUSTOMER#${mockCustomerId}`,
      GSI1SK: 'SUBMISSION#2024-01-01T10:00:00Z',
      GSI2PK: 'STUDENT#student-1',
      GSI2SK: 'SUBMISSION#2024-01-01T10:00:00Z'
    }];
    
    mockDocClientSend.mockResolvedValueOnce({ Items: mockSubmissions });
    mockS3ClientSend.mockResolvedValueOnce({});
    
    const result = await exportService.exportToExcel(mockExamId, mockCustomerId);
    
    expect(result.format).toBe('EXCEL');
    expect(result.recordCount).toBe(1);
  });
  
  it('should enforce multi-tenant isolation', async () => {
    const mockSubmissions: SubmissionRecord[] = [{
      PK: `EXAM#${mockExamId}`,
      SK: 'SUBMISSION#sub-1',
      submissionId: 'sub-1',
      examId: mockExamId,
      customerId: 'different-customer',
      studentId: 'student-1',
      studentName: 'Unauthorized',
      submittedAt: '2024-01-01T10:00:00Z',
      status: 'GRADED',
      documentS3Key: 'doc1.pdf',
      pageCount: 3,
      gradingDecisions: [{
        questionNumber: '1',
        marksAwarded: 10,
        maxMarks: 10,
        confidence: 95.0,
        explanation: 'Perfect',
        isPartialCredit: false,
        requiresReview: false
      }],
      manualOverrides: [],
      isFinalized: true,
      GSI1PK: 'CUSTOMER#different-customer',
      GSI1SK: 'SUBMISSION#2024-01-01T10:00:00Z',
      GSI2PK: 'STUDENT#student-1',
      GSI2SK: 'SUBMISSION#2024-01-01T10:00:00Z'
    }];
    
    mockDocClientSend.mockResolvedValueOnce({ Items: mockSubmissions });
    
    await expect(
      exportService.exportToCSV(mockExamId, mockCustomerId)
    ).rejects.toThrow('Access denied');
  });
});
