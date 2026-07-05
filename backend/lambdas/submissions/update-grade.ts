/**
 * Update Grade Handler
 * 
 * Allows teachers to manually override AI-generated grades for specific questions.
 * Stores both original AI grade and manual override with metadata.
 * 
 * Requirements: 7.3
 * - Accept manual grade overrides
 * - Require reason for modification
 * - Preserve original AI grade
 * - Store reviewer metadata
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SubmissionManagementService } from '../layers/shared/nodejs/submission-management-service';
import { ManualGradeOverride } from '../layers/shared/nodejs/exam-types';

/**
 * Lambda handler for updating grades
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const submissionService = new SubmissionManagementService();
  
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    const teacherId = event.requestContext.authorizer?.userId || 'unknown';
    
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
    
    // Extract submissionId and questionNumber from path parameters
    const submissionId = event.pathParameters?.submissionId;
    const questionNumber = event.pathParameters?.questionNumber;
    
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
    
    if (!questionNumber) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing questionNumber in path' })
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
    const validationError = validateGradeUpdate(body);
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
    
    // Create manual grade override
    const manualGrade: ManualGradeOverride = {
      questionNumber,
      originalMarks: body.originalMarks,
      overriddenMarks: body.overriddenMarks,
      reason: body.reason,
      reviewedBy: teacherId,
      reviewedAt: new Date().toISOString()
    };
    
    // Update grade in database
    await submissionService.updateGrade(
      submissionId,
      questionNumber,
      manualGrade,
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
        message: 'Grade updated successfully',
        submissionId,
        questionNumber,
        manualGrade
      })
    };
    
  } catch (error) {
    console.error('Error updating grade:', error);
    
    // Check if it's a validation error
    if (error instanceof Error && 
        (error.message.includes('requires') || error.message.includes('not found'))) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Invalid request',
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
        error: 'Failed to update grade',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Validates grade update request
 */
function validateGradeUpdate(body: any): string | null {
  if (typeof body.originalMarks !== 'number' || body.originalMarks < 0) {
    return 'originalMarks must be a non-negative number';
  }
  
  if (typeof body.overriddenMarks !== 'number' || body.overriddenMarks < 0) {
    return 'overriddenMarks must be a non-negative number';
  }
  
  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    return 'reason is required for grade modification';
  }
  
  return null;
}
