/**
 * Batch Submission Upload Handler
 * 
 * Accepts batch uploads of student submissions and queues each for processing.
 * Tracks batch processing status in DynamoDB and emits progress events.
 * 
 * Requirements: 8.1, 8.4
 * - Accept batch uploads of multiple submissions
 * - Send each submission to SQS queue for processing
 * - Track batch processing status in DynamoDB
 * - Emit progress events for each submission
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import {
  BatchSubmissionRequest,
  BatchProcessingStatus,
  BatchProcessingRecord,
  BatchSubmissionProgress,
  SQSSubmissionMessage
} from '../layers/shared/nodejs/exam-types';
import {
  withAWSRetry,
  processBatchWithErrorHandling,
  createErrorResponse,
  logError,
  ErrorContext
} from '../layers/shared/nodejs/error-handler';

const TABLE_NAME = process.env.EXAMS_TABLE_NAME || 'ExamGradingSystem';
const QUEUE_URL = process.env.GRADING_QUEUE_URL;

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

/**
 * Lambda handler for batch submission upload
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const errorContext: ErrorContext = {
    operation: 'batchUpload',
  };
  
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    
    if (!customerId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Unauthorized: Missing customer ID' })
      };
    }
    
    errorContext.customerId = customerId;
    
    // Validate queue URL is configured
    if (!QUEUE_URL) {
      logError(new Error('GRADING_QUEUE_URL environment variable not set'), errorContext);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }
    
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }
    
    const request: BatchSubmissionRequest = JSON.parse(event.body);
    
    // Validate request
    const validationError = validateBatchRequest(request);
    if (validationError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: validationError })
      };
    }
    
    errorContext.examId = request.examId;
    
    // Create batch processing record
    const batchId = uuidv4();
    const now = new Date().toISOString();
    
    const batchStatus: BatchProcessingStatus = {
      batchId,
      examId: request.examId,
      customerId,
      totalSubmissions: request.submissions.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      status: 'QUEUED',
      createdAt: now,
      updatedAt: now,
      submissions: []
    };
    
    // Create submission progress entries
    const submissionProgresses: BatchSubmissionProgress[] = [];
    const sqsMessages: SQSSubmissionMessage[] = [];
    
    for (const item of request.submissions) {
      const submissionId = uuidv4();
      
      submissionProgresses.push({
        submissionId,
        studentId: item.studentId,
        studentName: item.studentName,
        status: 'QUEUED'
      });
      
      sqsMessages.push({
        submissionId,
        batchId,
        examId: request.examId,
        customerId,
        studentId: item.studentId,
        studentName: item.studentName,
        documentUrl: item.documentUrl
      });
    }
    
    batchStatus.submissions = submissionProgresses;
    
    // Store batch processing record in DynamoDB with retry
    const batchRecord: BatchProcessingRecord = {
      PK: `CUSTOMER#${customerId}`,
      SK: `BATCH#${batchId}`,
      batchId,
      examId: request.examId,
      customerId,
      totalSubmissions: request.submissions.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      status: 'QUEUED',
      createdAt: now,
      updatedAt: now,
      submissions: submissionProgresses,
      GSI1PK: `EXAM#${request.examId}`,
      GSI1SK: `BATCH#${now}`
    };
    
    await withAWSRetry(
      async () => {
        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: batchRecord
        }));
      },
      'DynamoDB',
      { ...errorContext, operation: 'saveBatchRecord' }
    );
    
    // Send each submission to SQS queue using batch error handling
    const results = await processBatchWithErrorHandling(
      sqsMessages,
      async (message) => {
        await withAWSRetry(
          async () => {
            await sqsClient.send(new SendMessageCommand({
              QueueUrl: QUEUE_URL,
              MessageBody: JSON.stringify(message),
              MessageAttributes: {
                batchId: {
                  DataType: 'String',
                  StringValue: batchId
                },
                examId: {
                  DataType: 'String',
                  StringValue: request.examId
                },
                customerId: {
                  DataType: 'String',
                  StringValue: customerId
                }
              }
            }));
          },
          'SQS',
          { ...errorContext, operation: 'queueSubmission', additionalInfo: { submissionId: message.submissionId } }
        );
        
        console.log(`Queued submission ${message.submissionId} for student ${message.studentId}`);
        return message.submissionId;
      },
      { ...errorContext, operation: 'queueBatchSubmissions' }
    );
    
    // Count successes and failures
    const queuedCount = results.successes.length;
    const failedQueueCount = results.failures.length;
    
    // Update batch status if some failed to queue
    if (failedQueueCount > 0) {
      const updatedSubmissions = batchStatus.submissions.map(sub => {
        const failure = results.failures.find(f => f.result === sub.submissionId);
        if (failure) {
          return {
            ...sub,
            status: 'FAILED' as const,
            error: failure.error.userMessage
          };
        }
        return sub;
      });
      
      await withAWSRetry(
        async () => {
          await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: `CUSTOMER#${customerId}`,
              SK: `BATCH#${batchId}`
            },
            UpdateExpression: 'SET submissions = :submissions, failedCount = :failedCount, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':submissions': updatedSubmissions,
              ':failedCount': failedQueueCount,
              ':updatedAt': new Date().toISOString()
            }
          }));
        },
        'DynamoDB',
        { ...errorContext, operation: 'updateBatchStatus' }
      );
      
      batchStatus.submissions = updatedSubmissions;
      batchStatus.failedCount = failedQueueCount;
    }
    
    // Return batch status
    return {
      statusCode: 202, // Accepted
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: `Batch upload accepted. ${queuedCount} submissions queued for processing.`,
        batchId,
        status: batchStatus,
        queuedCount,
        failedCount: failedQueueCount
      })
    };
    
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error : new Error(String(error)),
      errorContext
    );
  }
};

/**
 * Validates batch submission request
 */
function validateBatchRequest(request: BatchSubmissionRequest): string | null {
  if (!request.examId || typeof request.examId !== 'string') {
    return 'Missing or invalid examId';
  }
  
  if (!Array.isArray(request.submissions) || request.submissions.length === 0) {
    return 'Missing or empty submissions array';
  }
  
  // Validate each submission item
  for (let i = 0; i < request.submissions.length; i++) {
    const item = request.submissions[i];
    
    if (!item.studentId || typeof item.studentId !== 'string') {
      return `Submission ${i}: Missing or invalid studentId`;
    }
    
    if (!item.studentName || typeof item.studentName !== 'string') {
      return `Submission ${i}: Missing or invalid studentName`;
    }
    
    if (!item.documentUrl || typeof item.documentUrl !== 'string') {
      return `Submission ${i}: Missing or invalid documentUrl`;
    }
  }
  
  return null;
}
