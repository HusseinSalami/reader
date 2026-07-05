/**
 * Get Batch Processing Status Handler
 * 
 * Retrieves the current status of a batch processing operation.
 * Shows progress for each submission in the batch.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { BatchProcessingRecord, BatchProcessingStatus } from '../layers/shared/nodejs/exam-types';

const TABLE_NAME = process.env.EXAMS_TABLE_NAME || 'ExamGradingSystem';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Lambda handler for getting batch status
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
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
    
    // Get batch ID from path parameters
    const batchId = event.pathParameters?.batchId;
    
    if (!batchId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing batchId parameter' })
      };
    }
    
    // Retrieve batch record from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `BATCH#${batchId}`
      }
    }));
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: `Batch ${batchId} not found` })
      };
    }
    
    const record = result.Item as BatchProcessingRecord;
    
    // Convert to BatchProcessingStatus
    const status: BatchProcessingStatus = {
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
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(status)
    };
    
  } catch (error) {
    console.error('Error retrieving batch status:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to retrieve batch status',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
