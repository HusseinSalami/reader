/**
 * Unit tests for SubmissionManagementService
 * 
 * Tests cover:
 * - Submission creation with proper DynamoDB record structure
 * - Submission retrieval with customer validation
 * - Listing submissions filtered by exam and customer
 * - Grade updates with manual override metadata
 * - Submission finalization
 * - Multi-tenant data isolation
 * - Error handling for invalid operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CreateSubmissionRequest,
  ManualGradeOverride,
  SubmissionRecord
} from './exam-types';

// Create mock send function
const mockSend = vi.fn();

// Mock AWS SDK BEFORE importing the service
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend }))
  },
  PutCommand: vi.fn((input) => ({ input })),
  GetCommand: vi.fn((input) => ({ input })),
  QueryCommand: vi.fn((input) => ({ input })),
  UpdateCommand: vi.fn((input) => ({ input }))
}));

// Import service AFTER mocks are set up
import { SubmissionManagementService } from './submission-management-service';

describe('SubmissionManagementService', () => {
  let service: SubmissionManagementService;
  const customerId = 'customer-789';
  const examId = 'exam-123';
  const submissionId = 'submission-456';
  
  beforeEach(() => {
    mockSend.mockReset();
    service = new SubmissionManagementService();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('createSubmission', () => {
    it('should create a submission with correct DynamoDB record structure', async () => {
      const submissionData: CreateSubmissionRequest = {
        examId,
        studentId: 'student-456',
        studentName: 'John Doe',
        documentUrl: 's3://bucket/submissions/doc.pdf'
      };
      
      mockSend.mockResolvedValueOnce({});
      
      const result = await service.createSubmission(submissionData, customerId);
      
      // Verify submission object
      expect(result.examId).toBe(examId);
      expect(result.studentId).toBe('student-456');
      expect(result.studentName).toBe('John Doe');
      expect(result.customerId).toBe(customerId);
      expect(result.status).toBe('UPLOADED');
      expect(result.isFinalized).toBe(false);
      expect(result.manualOverrides).toEqual([]);
      expect(result.submissionId).toBeDefined();
      expect(result.submittedAt).toBe('2024-01-15T10:00:00.000Z');
      
      // Verify DynamoDB PutCommand was called
      expect(mockSend).toHaveBeenCalledTimes(1);
      const putItem = mockSend.mock.calls[0][0].input.Item as SubmissionRecord;
      
      expect(putItem.PK).toBe(`EXAM#${examId}`);
      expect(putItem.SK).toMatch(/^SUBMISSION#/);
      expect(putItem.customerId).toBe(customerId);
      expect(putItem.studentId).toBe('student-456');
      expect(putItem.studentName).toBe('John Doe');
      expect(putItem.documentS3Key).toBe('s3://bucket/submissions/doc.pdf');
      expect(putItem.status).toBe('UPLOADED');
      expect(putItem.isFinalized).toBe(false);
      
      // Verify GSI attributes
      expect(putItem.GSI1PK).toBe(`CUSTOMER#${customerId}`);
      expect(putItem.GSI1SK).toBe('SUBMISSION#2024-01-15T10:00:00.000Z');
      expect(putItem.GSI2PK).toBe('STUDENT#student-456');
      expect(putItem.GSI2SK).toBe('SUBMISSION#2024-01-15T10:00:00.000Z');
    });
    
    it('should generate unique submission IDs', async () => {
      const submissionData: CreateSubmissionRequest = {
        examId,
        studentId: 'student-456',
        studentName: 'John Doe',
        documentUrl: 's3://bucket/doc.pdf'
      };
      
      mockSend.mockResolvedValue({});
      
      const result1 = await service.createSubmission(submissionData, customerId);
      const result2 = await service.createSubmission(submissionData, customerId);
      
      expect(result1.submissionId).not.toBe(result2.submissionId);
    });
  });
  
  describe('getSubmission', () => {
    it('should retrieve a submission by ID with customer validation', async () => {
      const mockRecord: SubmissionRecord = {
        PK: `EXAM#${examId}`,
        SK: `SUBMISSION#${submissionId}`,
        submissionId,
        examId,
        customerId,
        studentId: 'student-456',
        studentName: 'John Doe',
        submittedAt: '2024-01-15T10:00:00Z',
        status: 'GRADED',
        documentS3Key: 's3://bucket/doc.pdf',
        pageCount: 5,
        manualOverrides: [],
        isFinalized: false,
        GSI1PK: `CUSTOMER#${customerId}`,
        GSI1SK: 'SUBMISSION#2024-01-15T10:00:00Z',
        GSI2PK: 'STUDENT#student-456',
        GSI2SK: 'SUBMISSION#2024-01-15T10:00:00Z'
      };
      
      mockSend.mockResolvedValueOnce({ Items: [mockRecord] });
      
      const result = await service.getSubmission(submissionId, customerId);
      
      expect(result.submissionId).toBe(submissionId);
      expect(result.examId).toBe(examId);
      expect(result.customerId).toBe(customerId);
      expect(result.studentId).toBe('student-456');
      expect(result.status).toBe('GRADED');
      
      // Verify query used GSI1
      expect(mockSend).toHaveBeenCalledTimes(1);
      const queryInput = mockSend.mock.calls[0][0].input;
      expect(queryInput.IndexName).toBe('GSI1');
      expect(queryInput.ExpressionAttributeValues[':pk']).toBe(`CUSTOMER#${customerId}`);
    });
    
    it('should throw error when submission not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      
      await expect(
        service.getSubmission(submissionId, customerId)
      ).rejects.toThrow(`Submission ${submissionId} not found for customer ${customerId}`);
    });
  });
  
  describe('listSubmissions', () => {
    it('should list all submissions for an exam filtered by customer', async () => {
      const mockRecords: SubmissionRecord[] = [
        {
          PK: `EXAM#${examId}`,
          SK: 'SUBMISSION#sub-1',
          submissionId: 'sub-1',
          examId,
          customerId,
          studentId: 'student-1',
          studentName: 'Alice',
          submittedAt: '2024-01-15T10:00:00Z',
          status: 'GRADED',
          documentS3Key: 's3://bucket/doc1.pdf',
          pageCount: 3,
          manualOverrides: [],
          isFinalized: false,
          GSI1PK: `CUSTOMER#${customerId}`,
          GSI1SK: 'SUBMISSION#2024-01-15T10:00:00Z',
          GSI2PK: 'STUDENT#student-1',
          GSI2SK: 'SUBMISSION#2024-01-15T10:00:00Z'
        },
        {
          PK: `EXAM#${examId}`,
          SK: 'SUBMISSION#sub-2',
          submissionId: 'sub-2',
          examId,
          customerId,
          studentId: 'student-2',
          studentName: 'Bob',
          submittedAt: '2024-01-15T11:00:00Z',
          status: 'FINALIZED',
          documentS3Key: 's3://bucket/doc2.pdf',
          pageCount: 5,
          manualOverrides: [],
          isFinalized: true,
          GSI1PK: `CUSTOMER#${customerId}`,
          GSI1SK: 'SUBMISSION#2024-01-15T11:00:00Z',
          GSI2PK: 'STUDENT#student-2',
          GSI2SK: 'SUBMISSION#2024-01-15T11:00:00Z'
        }
      ];
      
      mockSend.mockResolvedValueOnce({ Items: mockRecords });
      
      const result = await service.listSubmissions(examId, customerId);
      
      expect(result.length).toBe(2);
      expect(result[0].submissionId).toBe('sub-1');
      expect(result[0].studentName).toBe('Alice');
      expect(result[1].submissionId).toBe('sub-2');
      expect(result[1].studentName).toBe('Bob');
      
      // Verify query structure
      const queryInput = mockSend.mock.calls[0][0].input;
      expect(queryInput.KeyConditionExpression).toContain('PK = :pk');
      expect(queryInput.FilterExpression).toContain('customerId = :customerId');
    });
    
    it('should return empty array when no submissions found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      
      const result = await service.listSubmissions(examId, customerId);
      
      expect(result).toEqual([]);
    });
  });
  
  describe('updateGrade', () => {
    const mockRecord: SubmissionRecord = {
      PK: `EXAM#${examId}`,
      SK: `SUBMISSION#${submissionId}`,
      submissionId,
      examId,
      customerId,
      studentId: 'student-456',
      studentName: 'John Doe',
      submittedAt: '2024-01-15T10:00:00Z',
      status: 'GRADED',
      documentS3Key: 's3://bucket/doc.pdf',
      pageCount: 5,
      manualOverrides: [],
      isFinalized: false,
      GSI1PK: `CUSTOMER#${customerId}`,
      GSI1SK: 'SUBMISSION#2024-01-15T10:00:00Z',
      GSI2PK: 'STUDENT#student-456',
      GSI2SK: 'SUBMISSION#2024-01-15T10:00:00Z'
    };
    
    it('should add manual grade override with metadata', async () => {
      const questionNumber = 'Q1';
      const manualGrade: ManualGradeOverride = {
        questionNumber,
        originalMarks: 5,
        overriddenMarks: 7,
        reason: 'Student showed correct understanding',
        reviewedBy: 'teacher-001',
        reviewedAt: '2024-01-15T12:00:00Z'
      };
      
      mockSend
        .mockResolvedValueOnce({ Items: [mockRecord] }) // getSubmission
        .mockResolvedValueOnce({}); // updateGrade
      
      await service.updateGrade(submissionId, questionNumber, manualGrade, customerId);
      
      // Verify UpdateCommand was called
      expect(mockSend).toHaveBeenCalledTimes(2);
      const updateInput = mockSend.mock.calls[1][0].input;
      
      expect(updateInput.Key).toEqual({
        PK: `EXAM#${examId}`,
        SK: `SUBMISSION#${submissionId}`
      });
      expect(updateInput.UpdateExpression).toContain('manualOverrides');
      
      const overrides = updateInput.ExpressionAttributeValues[':overrides'];
      expect(overrides).toHaveLength(1);
      expect(overrides[0]).toEqual(manualGrade);
    });
    
    it('should update existing manual override for same question', async () => {
      const questionNumber = 'Q1';
      const existingOverride: ManualGradeOverride = {
        questionNumber,
        originalMarks: 5,
        overriddenMarks: 6,
        reason: 'First review',
        reviewedBy: 'teacher-001',
        reviewedAt: '2024-01-15T12:00:00Z'
      };
      
      const newOverride: ManualGradeOverride = {
        questionNumber,
        originalMarks: 5,
        overriddenMarks: 7,
        reason: 'Second review',
        reviewedBy: 'teacher-001',
        reviewedAt: '2024-01-15T13:00:00Z'
      };
      
      const recordWithOverride = { ...mockRecord, manualOverrides: [existingOverride] };
      
      mockSend
        .mockResolvedValueOnce({ Items: [recordWithOverride] })
        .mockResolvedValueOnce({});
      
      await service.updateGrade(submissionId, questionNumber, newOverride, customerId);
      
      const updateInput = mockSend.mock.calls[1][0].input;
      const overrides = updateInput.ExpressionAttributeValues[':overrides'];
      expect(overrides).toHaveLength(1);
      expect(overrides[0]).toEqual(newOverride);
    });
    
    it('should preserve existing overrides for other questions', async () => {
      const existingOverride: ManualGradeOverride = {
        questionNumber: 'Q1',
        originalMarks: 5,
        overriddenMarks: 6,
        reason: 'First question',
        reviewedBy: 'teacher-001',
        reviewedAt: '2024-01-15T12:00:00Z'
      };
      
      const newOverride: ManualGradeOverride = {
        questionNumber: 'Q2',
        originalMarks: 8,
        overriddenMarks: 9,
        reason: 'Second question',
        reviewedBy: 'teacher-001',
        reviewedAt: '2024-01-15T13:00:00Z'
      };
      
      const recordWithOverride = { ...mockRecord, manualOverrides: [existingOverride] };
      
      mockSend
        .mockResolvedValueOnce({ Items: [recordWithOverride] })
        .mockResolvedValueOnce({});
      
      await service.updateGrade(submissionId, 'Q2', newOverride, customerId);
      
      const updateInput = mockSend.mock.calls[1][0].input;
      const overrides = updateInput.ExpressionAttributeValues[':overrides'];
      expect(overrides).toHaveLength(2);
      expect(overrides).toContainEqual(existingOverride);
      expect(overrides).toContainEqual(newOverride);
    });
    
    it('should throw error when reason is empty', async () => {
      const invalidGrade: ManualGradeOverride = {
        questionNumber: 'Q1',
        originalMarks: 5,
        overriddenMarks: 7,
        reason: '',
        reviewedBy: 'teacher-001',
        reviewedAt: '2024-01-15T12:00:00Z'
      };
      
      mockSend.mockResolvedValueOnce({ Items: [mockRecord] });
      
      await expect(
        service.updateGrade(submissionId, 'Q1', invalidGrade, customerId)
      ).rejects.toThrow('Manual grade override requires a non-empty reason');
    });
    
    it('should throw error when reviewedBy is empty', async () => {
      const invalidGrade: ManualGradeOverride = {
        questionNumber: 'Q1',
        originalMarks: 5,
        overriddenMarks: 7,
        reason: 'Valid reason',
        reviewedBy: '',
        reviewedAt: '2024-01-15T12:00:00Z'
      };
      
      mockSend.mockResolvedValueOnce({ Items: [mockRecord] });
      
      await expect(
        service.updateGrade(submissionId, 'Q1', invalidGrade, customerId)
      ).rejects.toThrow('Manual grade override requires reviewedBy identifier');
    });
    
    it('should set reviewedAt timestamp if not provided', async () => {
      const manualGrade: ManualGradeOverride = {
        questionNumber: 'Q1',
        originalMarks: 5,
        overriddenMarks: 7,
        reason: 'Valid reason',
        reviewedBy: 'teacher-001',
        reviewedAt: ''
      };
      
      mockSend
        .mockResolvedValueOnce({ Items: [mockRecord] })
        .mockResolvedValueOnce({});
      
      await service.updateGrade(submissionId, 'Q1', manualGrade, customerId);
      
      const updateInput = mockSend.mock.calls[1][0].input;
      const overrides = updateInput.ExpressionAttributeValues[':overrides'];
      expect(overrides[0].reviewedAt).toBeDefined();
      expect(overrides[0].reviewedAt).not.toBe('');
    });
  });
  
  describe('finalizeSubmission', () => {
    const mockRecord: SubmissionRecord = {
      PK: `EXAM#${examId}`,
      SK: `SUBMISSION#${submissionId}`,
      submissionId,
      examId,
      customerId,
      studentId: 'student-456',
      studentName: 'John Doe',
      submittedAt: '2024-01-15T10:00:00Z',
      status: 'GRADED',
      documentS3Key: 's3://bucket/doc.pdf',
      pageCount: 5,
      manualOverrides: [],
      isFinalized: false,
      GSI1PK: `CUSTOMER#${customerId}`,
      GSI1SK: 'SUBMISSION#2024-01-15T10:00:00Z',
      GSI2PK: 'STUDENT#student-456',
      GSI2SK: 'SUBMISSION#2024-01-15T10:00:00Z'
    };
    
    it('should mark submission as finalized with timestamp', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [mockRecord] }) // getSubmission
        .mockResolvedValueOnce({}); // finalizeSubmission
      
      await service.finalizeSubmission(submissionId, customerId);
      
      // Verify UpdateCommand was called
      expect(mockSend).toHaveBeenCalledTimes(2);
      const updateInput = mockSend.mock.calls[1][0].input;
      
      expect(updateInput.Key).toEqual({
        PK: `EXAM#${examId}`,
        SK: `SUBMISSION#${submissionId}`
      });
      expect(updateInput.UpdateExpression).toContain('isFinalized');
      expect(updateInput.UpdateExpression).toContain('finalizedAt');
      expect(updateInput.UpdateExpression).toContain('#status');
      
      expect(updateInput.ExpressionAttributeValues[':isFinalized']).toBe(true);
      expect(updateInput.ExpressionAttributeValues[':status']).toBe('FINALIZED');
      expect(updateInput.ExpressionAttributeValues[':finalizedAt']).toBe('2024-01-15T10:00:00.000Z');
    });
    
    it('should enforce customer validation when finalizing', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [mockRecord] })
        .mockResolvedValueOnce({});
      
      await service.finalizeSubmission(submissionId, customerId);
      
      const updateInput = mockSend.mock.calls[1][0].input;
      expect(updateInput.ConditionExpression).toContain('customerId = :customerId');
      expect(updateInput.ExpressionAttributeValues[':customerId']).toBe(customerId);
    });
  });
  
  describe('Multi-tenant isolation', () => {
    it('should include customerId in all DynamoDB operations', async () => {
      // Test createSubmission
      mockSend.mockResolvedValueOnce({});
      await service.createSubmission({
        examId,
        studentId: 'student-456',
        studentName: 'John Doe',
        documentUrl: 's3://bucket/doc.pdf'
      }, customerId);
      
      expect(mockSend.mock.calls[0][0].input.Item.customerId).toBe(customerId);
      
      // Test getSubmission
      mockSend.mockResolvedValueOnce({
        Items: [{
          PK: `EXAM#${examId}`,
          SK: `SUBMISSION#${submissionId}`,
          submissionId,
          examId,
          customerId,
          studentId: 'student-456',
          studentName: 'John Doe',
          submittedAt: '2024-01-15T10:00:00Z',
          status: 'GRADED',
          documentS3Key: 's3://bucket/doc.pdf',
          pageCount: 5,
          manualOverrides: [],
          isFinalized: false,
          GSI1PK: `CUSTOMER#${customerId}`,
          GSI1SK: 'SUBMISSION#2024-01-15T10:00:00Z',
          GSI2PK: 'STUDENT#student-456',
          GSI2SK: 'SUBMISSION#2024-01-15T10:00:00Z'
        }]
      });
      
      await service.getSubmission(submissionId, customerId);
      
      const queryInput = mockSend.mock.calls[1][0].input;
      expect(queryInput.ExpressionAttributeValues[':pk']).toBe(`CUSTOMER#${customerId}`);
    });
  });
});
