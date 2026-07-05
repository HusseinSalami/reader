/**
 * Get Submission Details Handler
 * 
 * Retrieves detailed information about a specific submission including
 * extracted answers, grading results, and manual overrides.
 * 
 * Requirements: 7.3
 * - Retrieve submission by ID
 * - Include all grading details
 * - Enforce multi-tenant isolation
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SubmissionManagementService } from '../layers/shared/nodejs/submission-management-service';

/**
 * Lambda handler for getting submission details
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
    
    // Get submission from database
    const submission = await submissionService.getSubmission(
      submissionId,
      customerId
    );
    
    // Return submission details
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(submission)
    };
    
  } catch (error) {
    console.error('Error getting submission:', error);
    
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
        error: 'Failed to get submission',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
