/**
 * Finalize Submission Handler
 * 
 * Marks a submission as finalized, indicating that all grades have been
 * reviewed and approved by the teacher. Once finalized, the submission
 * should not be modified further.
 * 
 * Requirements: 7.6
 * - Mark submission as finalized
 * - Update status to FINALIZED
 * - Record finalization timestamp
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SubmissionManagementService } from '../layers/shared/nodejs/submission-management-service';

/**
 * Lambda handler for finalizing submissions
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
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
    
    // Extract submissionId from path parameters
    const submissionId = event.pathParameters?.submissionId;
    if (!submissionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing submissionId in path' })
      };
    }
    
    // Finalize submission in database
    await submissionService.finalizeSubmission(
      submissionId,
      customerId
    );
    
    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Submission finalized successfully',
        submissionId,
        finalizedAt: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error finalizing submission:', error);
    
    // Check if it's a not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Submission not found',
          message: error.message
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to finalize submission',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
