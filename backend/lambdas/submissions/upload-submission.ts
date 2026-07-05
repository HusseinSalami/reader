/**
 * Single Submission Upload Handler
 * 
 * Accepts a single student submission upload and queues it for processing.
 * 
 * Requirements: 14.4
 * - Accept single submission upload with student identification
 * - Validate required fields
 * - Queue submission for processing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import { SubmissionManagementService } from '../layers/shared/nodejs/submission-management-service';
import {
  CreateSubmissionRequest,
  SQSSubmissionMessage
} from '../layers/shared/nodejs/exam-types';

const QUEUE_URL = process.env.GRADING_QUEUE_URL;

/**
 * Lambda handler for single submission upload
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const sqsClient = new SQSClient({});
  const submissionService = new SubmissionManagementService();
  
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
    
    // Extract examId from path parameters
    const examId = event.pathParameters?.examId;
    if (!examId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing examId in path' })
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
    
    const body = JSON.parse(event.body);
    
    // Validate required fields
    const validationError = validateSubmissionRequest(body, examId);
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
    
    // Validate queue URL is configured
    if (!QUEUE_URL) {
      console.error('GRADING_QUEUE_URL environment variable not set');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }
    
    // Create submission request
    const submissionRequest: CreateSubmissionRequest = {
      examId,
      studentId: body.studentId,
      studentName: body.studentName,
      documentUrl: body.documentUrl
    };
    
    // Create submission in database
    const submission = await submissionService.createSubmission(
      submissionRequest,
      customerId
    );
    
    // Queue submission for processing
    const sqsMessage: SQSSubmissionMessage = {
      submissionId: submission.submissionId,
      batchId: '', // Empty for single submissions
      examId,
      customerId,
      studentId: body.studentId,
      studentName: body.studentName,
      documentUrl: body.documentUrl
    };
    
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(sqsMessage),
      MessageAttributes: {
        examId: {
          DataType: 'String',
          StringValue: examId
        },
        customerId: {
          DataType: 'String',
          StringValue: customerId
        },
        submissionId: {
          DataType: 'String',
          StringValue: submission.submissionId
        }
      }
    }));
    
    console.log(`Queued submission ${submission.submissionId} for student ${body.studentId}`);
    
    // Return created submission
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Submission uploaded successfully and queued for processing',
        submission
      })
    };
    
  } catch (error) {
    console.error('Error uploading submission:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to upload submission',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Validates submission request
 */
function validateSubmissionRequest(body: any, examId: string): string | null {
  if (!body.studentId || typeof body.studentId !== 'string' || body.studentId.trim().length === 0) {
    return 'Student ID is required for submission upload';
  }
  
  if (!body.studentName || typeof body.studentName !== 'string' || body.studentName.trim().length === 0) {
    return 'Student name is required for submission upload';
  }
  
  if (!body.documentUrl || typeof body.documentUrl !== 'string' || body.documentUrl.trim().length === 0) {
    return 'Document URL is required for submission upload';
  }
  
  return null;
}
