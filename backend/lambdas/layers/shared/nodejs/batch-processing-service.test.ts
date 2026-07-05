/**
 * Unit tests for BatchProcessingService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BatchProcessingService } from './batch-processing-service';
import { BatchProcessingRecord } from './exam-types';

const dynamoMock = mockClient(DynamoDBDocumentClient);

process.env.EXAMS_TABLE_NAME = 'TestExamsTable';

describe('BatchProcessingService', () => {
  let service: BatchProcessingService;

  beforeEach(() => {
    dynamoMock.reset();
    service = new BatchProcessingService();
  });

  describe('updateSubmissionStatus', () => {
    it('should update submission status to PROCESSING', async () => {
      const batchRecord: BatchProcessingRecord = {
        PK: 'CUSTOMER#customer-123',
        SK: 'BATCH#batch-123',
        batchId: 'batch-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        totalSubmissions: 2,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        status: 'QUEUED',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        submissions: [
          {
            submissionId: 'sub-1',
            studentId: 'student-1',
            studentName: 'Alice',
            status: 'QUEUED'
          },
          {
            submissionId: 'sub-2',
            studentId: 'student-2',
            studentName: 'Bob',
            status: 'QUEUED'
          }
        ],
        GSI1PK: 'EXAM#exam-123',
        GSI1SK: 'BATCH#2024-01-01T00:00:00Z'
      };

      dynamoMock.on(GetCommand).resolves({ Item: batchRecord });
      dynamoMock.on(UpdateCommand).resolves({});

      await service.updateSubmissionStatus(
        'batch-123',
        'customer-123',
        'sub-1',
        'PROCESSING'
      );

      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      expect(updateCalls).toHaveLength(1);

      const updateParams = updateCalls[0].args[0].input;
      // When no submissions are completed yet, batch status should remain QUEUED
      expect(updateParams.ExpressionAttributeValues[':status']).toBe('QUEUED');
      expect(updateParams.ExpressionAttributeValues[':processedCount']).toBe(0);
    });

    it('should update submission status to COMPLETED and increment counters', async () => {
      const batchRecord: BatchProcessingRecord = {
        PK: 'CUSTOMER#customer-123',
        SK: 'BATCH#batch-123',
        batchId: 'batch-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        totalSubmissions: 2,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        status: 'PROCESSING',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        submissions: [
          {
            submissionId: 'sub-1',
            studentId: 'student-1',
            studentName: 'Alice',
            status: 'PROCESSING'
          },
          {
            submissionId: 'sub-2',
            studentId: 'student-2',
            studentName: 'Bob',
            status: 'QUEUED'
          }
        ],
        GSI1PK: 'EXAM#exam-123',
        GSI1SK: 'BATCH#2024-01-01T00:00:00Z'
      };

      dynamoMock.on(GetCommand).resolves({ Item: batchRecord });
      dynamoMock.on(UpdateCommand).resolves({});

      await service.updateSubmissionStatus(
        'batch-123',
        'customer-123',
        'sub-1',
        'COMPLETED'
      );

      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      expect(updateCalls).toHaveLength(1);

      const updateParams = updateCalls[0].args[0].input;
      expect(updateParams.ExpressionAttributeValues[':processedCount']).toBe(1);
      expect(updateParams.ExpressionAttributeValues[':successCount']).toBe(1);
      expect(updateParams.ExpressionAttributeValues[':failedCount']).toBe(0);
      expect(updateParams.ExpressionAttributeValues[':status']).toBe('PROCESSING');
    });

    it('should update submission status to FAILED and increment failed counter', async () => {
      const batchRecord: BatchProcessingRecord = {
        PK: 'CUSTOMER#customer-123',
        SK: 'BATCH#batch-123',
        batchId: 'batch-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        totalSubmissions: 2,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        status: 'PROCESSING',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        submissions: [
          {
            submissionId: 'sub-1',
            studentId: 'student-1',
            studentName: 'Alice',
            status: 'PROCESSING'
          },
          {
            submissionId: 'sub-2',
            studentId: 'student-2',
            studentName: 'Bob',
            status: 'QUEUED'
          }
        ],
        GSI1PK: 'EXAM#exam-123',
        GSI1SK: 'BATCH#2024-01-01T00:00:00Z'
      };

      dynamoMock.on(GetCommand).resolves({ Item: batchRecord });
      dynamoMock.on(UpdateCommand).resolves({});

      await service.updateSubmissionStatus(
        'batch-123',
        'customer-123',
        'sub-1',
        'FAILED',
        'Processing error'
      );

      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      expect(updateCalls).toHaveLength(1);

      const updateParams = updateCalls[0].args[0].input;
      expect(updateParams.ExpressionAttributeValues[':processedCount']).toBe(1);
      expect(updateParams.ExpressionAttributeValues[':successCount']).toBe(0);
      expect(updateParams.ExpressionAttributeValues[':failedCount']).toBe(1);
    });

    it('should set batch status to COMPLETED when all submissions are processed', async () => {
      const batchRecord: BatchProcessingRecord = {
        PK: 'CUSTOMER#customer-123',
        SK: 'BATCH#batch-123',
        batchId: 'batch-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        totalSubmissions: 2,
        processedCount: 1,
        successCount: 1,
        failedCount: 0,
        status: 'PROCESSING',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        submissions: [
          {
            submissionId: 'sub-1',
            studentId: 'student-1',
            studentName: 'Alice',
            status: 'COMPLETED'
          },
          {
            submissionId: 'sub-2',
            studentId: 'student-2',
            studentName: 'Bob',
            status: 'PROCESSING'
          }
        ],
        GSI1PK: 'EXAM#exam-123',
        GSI1SK: 'BATCH#2024-01-01T00:00:00Z'
      };

      dynamoMock.on(GetCommand).resolves({ Item: batchRecord });
      dynamoMock.on(UpdateCommand).resolves({});

      await service.updateSubmissionStatus(
        'batch-123',
        'customer-123',
        'sub-2',
        'COMPLETED'
      );

      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      const updateParams = updateCalls[0].args[0].input;
      
      expect(updateParams.ExpressionAttributeValues[':processedCount']).toBe(2);
      expect(updateParams.ExpressionAttributeValues[':successCount']).toBe(2);
      expect(updateParams.ExpressionAttributeValues[':status']).toBe('COMPLETED');
    });

    it('should set batch status to FAILED when all submissions fail', async () => {
      const batchRecord: BatchProcessingRecord = {
        PK: 'CUSTOMER#customer-123',
        SK: 'BATCH#batch-123',
        batchId: 'batch-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        totalSubmissions: 2,
        processedCount: 1,
        successCount: 0,
        failedCount: 1,
        status: 'PROCESSING',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        submissions: [
          {
            submissionId: 'sub-1',
            studentId: 'student-1',
            studentName: 'Alice',
            status: 'FAILED',
            error: 'Error 1'
          },
          {
            submissionId: 'sub-2',
            studentId: 'student-2',
            studentName: 'Bob',
            status: 'PROCESSING'
          }
        ],
        GSI1PK: 'EXAM#exam-123',
        GSI1SK: 'BATCH#2024-01-01T00:00:00Z'
      };

      dynamoMock.on(GetCommand).resolves({ Item: batchRecord });
      dynamoMock.on(UpdateCommand).resolves({});

      await service.updateSubmissionStatus(
        'batch-123',
        'customer-123',
        'sub-2',
        'FAILED',
        'Error 2'
      );

      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      const updateParams = updateCalls[0].args[0].input;
      
      expect(updateParams.ExpressionAttributeValues[':processedCount']).toBe(2);
      expect(updateParams.ExpressionAttributeValues[':failedCount']).toBe(2);
      expect(updateParams.ExpressionAttributeValues[':status']).toBe('FAILED');
    });

    it('should throw error if batch not found', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined });

      await expect(
        service.updateSubmissionStatus(
          'batch-123',
          'customer-123',
          'sub-1',
          'COMPLETED'
        )
      ).rejects.toThrow('Batch batch-123 not found');
    });
  });

  describe('getBatchStatus', () => {
    it('should retrieve batch status', async () => {
      const batchRecord: BatchProcessingRecord = {
        PK: 'CUSTOMER#customer-123',
        SK: 'BATCH#batch-123',
        batchId: 'batch-123',
        examId: 'exam-123',
        customerId: 'customer-123',
        totalSubmissions: 2,
        processedCount: 1,
        successCount: 1,
        failedCount: 0,
        status: 'PROCESSING',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:01:00Z',
        submissions: [
          {
            submissionId: 'sub-1',
            studentId: 'student-1',
            studentName: 'Alice',
            status: 'COMPLETED'
          },
          {
            submissionId: 'sub-2',
            studentId: 'student-2',
            studentName: 'Bob',
            status: 'PROCESSING'
          }
        ],
        GSI1PK: 'EXAM#exam-123',
        GSI1SK: 'BATCH#2024-01-01T00:00:00Z'
      };

      dynamoMock.on(GetCommand).resolves({ Item: batchRecord });

      const status = await service.getBatchStatus('batch-123', 'customer-123');

      expect(status.batchId).toBe('batch-123');
      expect(status.examId).toBe('exam-123');
      expect(status.totalSubmissions).toBe(2);
      expect(status.processedCount).toBe(1);
      expect(status.successCount).toBe(1);
      expect(status.failedCount).toBe(0);
      expect(status.status).toBe('PROCESSING');
      expect(status.submissions).toHaveLength(2);
    });

    it('should throw error if batch not found', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined });

      await expect(
        service.getBatchStatus('batch-123', 'customer-123')
      ).rejects.toThrow('Batch batch-123 not found');
    });
  });

  describe('emitProgressEvent', () => {
    it('should log progress event', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await service.emitProgressEvent('batch-123', {
        submissionId: 'sub-1',
        studentId: 'student-1',
        studentName: 'Alice',
        status: 'COMPLETED'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Progress event:',
        expect.objectContaining({
          batchId: 'batch-123',
          submissionId: 'sub-1',
          status: 'COMPLETED'
        })
      );
    });
  });
});
