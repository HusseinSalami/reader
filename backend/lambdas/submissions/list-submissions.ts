/**
 * List Submissions Handler
 * 
 * Retrieves all submissions for a specific exam with multi-tenant isolation.
 * Returns summary information for each submission including grading status.
 * 
 * Requirements: 15.2
 * - List all submissions for an exam
 * - Filter by customer ID
 * - Include grading status and scores
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SubmissionManagementService } from '../layers/shared/nodejs/submission-management-service';

/**
 * Lambda handler for listing submissions
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
    
    // Get submissions from database
    const submissions = await submissionService.listSubmissions(
      examId,
      customerId
    );
    
    // Return submissions list
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        examId,
        count: submissions.length,
        submissions
      })
    };
    
  } catch (error) {
    console.error('Error listing submissions:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to list submissions',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
