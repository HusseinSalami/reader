/**
 * BatchProcessingService
 * 
 * Manages batch processing status updates and progress tracking.
 * Used by SQS consumers to update batch status as submissions are processed.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { 
  BatchProcessingRecord,
  BatchProcessingStatus,
  BatchSubmissionProgress
} from './exam-types';

const TABLE_NAME = process.env.EXAMS_TABLE_NAME || 'ExamGradingSystem';

export class BatchProcessingService {
  private docClient: DynamoDBDocumentClient;
  
  constructor() {
    const dynamoClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
  }
  
  /**
   * Updates the status of a single submission within a batch
   * Automatically updates batch-level counters and status
   * 
   * @param batchId - Batch identifier
   * @param customerId - Customer identifier
   * @param submissionId - Submission identifier
   * @param status - New status for the submission
   * @param error - Optional error message if failed
   */
  async updateSubmissionStatus(
    batchId: string,
    customerId: string,
    submissionId: string,
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
    error?: string
  ): Promise<void> {
    // Get current batch record
    const result = await this.docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `BATCH#${batchId}`
      }
    }));
    
    if (!result.Item) {
      throw new Error(`Batch ${batchId} not found for customer ${customerId}`);
    }
    
    const record = result.Item as BatchProcessingRecord;
    
    // Find and update the submission
    const updatedSubmissions = record.submissions.map(sub => {
      if (sub.submissionId === submissionId) {
        return {
          ...sub,
          status,
          error,
          processedAt: status === 'COMPLETED' || status === 'FAILED' 
            ? new Date().toISOString() 
            : sub.processedAt
        };
      }
      return sub;
    });
    
    // Calculate new counters
    const processedCount = updatedSubmissions.filter(
      sub => sub.status === 'COMPLETED' || sub.status === 'FAILED'
    ).length;
    
    const successCount = updatedSubmissions.filter(
      sub => sub.status === 'COMPLETED'
    ).length;
    
    const failedCount = updatedSubmissions.filter(
      sub => sub.status === 'FAILED'
    ).length;
    
    // Determine batch status
    let batchStatus: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    
    if (processedCount === 0) {
      batchStatus = 'QUEUED';
    } else if (processedCount < record.totalSubmissions) {
      batchStatus = 'PROCESSING';
    } else if (failedCount === record.totalSubmissions) {
      batchStatus = 'FAILED';
    } else {
      batchStatus = 'COMPLETED';
    }
    
    // Update batch record
    await this.docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `BATCH#${batchId}`
      },
      UpdateExpression: `
        SET submissions = :submissions,
            processedCount = :processedCount,
            successCount = :successCount,
            failedCount = :failedCount,
            #status = :status,
            updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':submissions': updatedSubmissions,
        ':processedCount': processedCount,
        ':successCount': successCount,
        ':failedCount': failedCount,
        ':status': batchStatus,
        ':updatedAt': new Date().toISOString()
      }
    }));
    
    console.log(`Updated batch ${batchId}: ${processedCount}/${record.totalSubmissions} processed (${successCount} success, ${failedCount} failed)`);
  }
  
  /**
   * Gets the current status of a batch
   * 
   * @param batchId - Batch identifier
   * @param customerId - Customer identifier
   * @returns Batch processing status
   */
  async getBatchStatus(
    batchId: string,
    customerId: string
  ): Promise<BatchProcessingStatus> {
    const result = await this.docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `BATCH#${batchId}`
      }
    }));
    
    if (!result.Item) {
      throw new Error(`Batch ${batchId} not found for customer ${customerId}`);
    }
    
    const record = result.Item as BatchProcessingRecord;
    
    return {
      batchId: record.batchId,
      examId: record.examId,
      customerId: record.customerId,
      totalSubmissions: record.totalSubmissions,
      processedCount: record.processedCount,
      successCount: record.successCount,
      failedCount: record.failedCount,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      submissions: record.submissions
    };
  }
  
  /**
   * Emits a progress event for a submission
   * This can be used to send real-time updates via WebSocket or EventBridge
   * 
   * @param batchId - Batch identifier
   * @param submissionProgress - Submission progress information
   */
  async emitProgressEvent(
    batchId: string,
    submissionProgress: BatchSubmissionProgress
  ): Promise<void> {
    // Log the progress event
    console.log('Progress event:', {
      batchId,
      submissionId: submissionProgress.submissionId,
      studentId: submissionProgress.studentId,
      status: submissionProgress.status,
      error: submissionProgress.error
    });
    
    // In a production system, this would publish to EventBridge or WebSocket API
    // For now, we just log it
    // Example:
    // await eventBridgeClient.send(new PutEventsCommand({
    //   Entries: [{
    //     Source: 'exam-grading-system',
    //     DetailType: 'SubmissionProgress',
    //     Detail: JSON.stringify({ batchId, ...submissionProgress })
    //   }]
    // }));
  }
}
