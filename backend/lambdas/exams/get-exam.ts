/**
 * Get Exam Lambda Handler
 * 
 * GET /exams/:examId
 * Retrieves exam details by ID
 * 
 * Requirements: 20.1, 20.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';
import { successResponse, errorResponse } from '../layers/shared/nodejs/utils';

/**
 * Lambda handler for getting an exam
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    if (!customerId) {
      return errorResponse('UNAUTHORIZED', 'Customer ID not found in authorization context', 401);
    }

    // Extract exam ID from path parameters
    const examId = event.pathParameters?.examId;
    if (!examId) {
      return errorResponse('INVALID_REQUEST', 'Exam ID is required', 400);
    }

    // Get exam
    const examService = new ExamManagementService();
    const exam = await examService.getExam(examId, customerId);

    return successResponse(exam, 200);
  } catch (error: any) {
    console.error('Error getting exam:', error);

    // Handle not found errors
    if (error.message.includes('not found')) {
      return errorResponse('NOT_FOUND', error.message, 404);
    }

    // Handle access denied errors
    if (error.message.includes('Access denied')) {
      return errorResponse('FORBIDDEN', error.message, 403);
    }

    return errorResponse('INTERNAL_ERROR', 'Failed to retrieve exam', 500);
  }
}
