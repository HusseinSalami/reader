/**
 * Update Exam Questions Lambda Handler
 * 
 * PUT /exams/:examId/questions
 * Updates exam questions (used by wizard for editing extracted questions)
 * 
 * Requirements: 20.1, 20.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';
import { Question } from '../layers/shared/nodejs/exam-types';
import { successResponse, errorResponse } from '../layers/shared/nodejs/utils';

/**
 * Lambda handler for updating exam questions
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

    // Parse request body
    if (!event.body) {
      return errorResponse('INVALID_REQUEST', 'Request body is required', 400);
    }

    const { questions } = JSON.parse(event.body) as { questions: Question[] };

    // Validate questions array
    if (!Array.isArray(questions)) {
      return errorResponse('VALIDATION_ERROR', 'Questions must be an array', 400);
    }

    // Validate each question has required fields
    for (const question of questions) {
      if (!question.questionNumber || !question.questionText || !question.sectionId) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Each question must have questionNumber, questionText, and sectionId',
          400
        );
      }

      if (typeof question.points !== 'number' || question.points < 0) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Each question must have a non-negative points value',
          400
        );
      }
    }

    // Update exam questions
    const examService = new ExamManagementService();
    await examService.updateExamQuestions(examId, questions, customerId);

    return successResponse({ message: 'Questions updated successfully' }, 200);
  } catch (error: any) {
    console.error('Error updating exam questions:', error);

    // Handle not found errors
    if (error.message.includes('not found')) {
      return errorResponse('NOT_FOUND', error.message, 404);
    }

    // Handle access denied errors
    if (error.message.includes('Access denied')) {
      return errorResponse('FORBIDDEN', error.message, 403);
    }

    // Handle validation errors
    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return errorResponse('VALIDATION_ERROR', error.message, 400);
    }

    return errorResponse('INTERNAL_ERROR', 'Failed to update exam questions', 500);
  }
}
