/**
 * Create Exam Lambda Handler
 * 
 * POST /exams
 * Creates a new exam with questionnaire and answer key
 * 
 * Requirements: 20.1, 20.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';
import { CreateExamRequest } from '../layers/shared/nodejs/exam-types';
import { successResponse, errorResponse } from '../layers/shared/nodejs/utils';

/**
 * Lambda handler for creating an exam
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    if (!customerId) {
      return errorResponse('UNAUTHORIZED', 'Customer ID not found in authorization context', 401);
    }

    // Parse request body
    if (!event.body) {
      return errorResponse('INVALID_REQUEST', 'Request body is required', 400);
    }

    const input: CreateExamRequest = JSON.parse(event.body);

    // Validate required fields
    if (!input.title || !input.teacherId) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Title and teacherId are required',
        400
      );
    }

    if (!input.questionnaireUrl || !input.answerKeyUrl) {
      return errorResponse(
        'VALIDATION_ERROR',
        'questionnaireUrl and answerKeyUrl are required',
        400
      );
    }

    // Create exam
    const examService = new ExamManagementService();
    const exam = await examService.createExam(input, customerId);

    return successResponse(exam, 201);
  } catch (error: any) {
    console.error('Error creating exam:', error);

    // Handle specific error types
    if (error.message.includes('already exists')) {
      return errorResponse('DUPLICATE_EXAM', error.message, 409);
    }

    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return errorResponse('VALIDATION_ERROR', error.message, 400);
    }

    return errorResponse('INTERNAL_ERROR', 'Failed to create exam', 500);
  }
}
