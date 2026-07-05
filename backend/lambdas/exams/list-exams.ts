/**
 * List Exams Lambda Handler
 * 
 * GET /exams
 * Lists all exams for a customer with optional filtering
 * 
 * Requirements: 20.1, 20.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';
import { ExamFilters, ExamStatus } from '../layers/shared/nodejs/exam-types';
import { successResponse, errorResponse } from '../layers/shared/nodejs/utils';

/**
 * Lambda handler for listing exams
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    if (!customerId) {
      return errorResponse('UNAUTHORIZED', 'Customer ID not found in authorization context', 401);
    }

    // Parse query parameters for filtering
    const filters: ExamFilters = {};
    
    if (event.queryStringParameters) {
      const { status, teacherId, createdAfter, createdBefore } = event.queryStringParameters;
      
      if (status) {
        // Validate status value
        const validStatuses: ExamStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
        if (!validStatuses.includes(status as ExamStatus)) {
          return errorResponse(
            'VALIDATION_ERROR',
            `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            400
          );
        }
        filters.status = status as ExamStatus;
      }
      
      if (teacherId) {
        filters.teacherId = teacherId;
      }
      
      if (createdAfter) {
        filters.createdAfter = createdAfter;
      }
      
      if (createdBefore) {
        filters.createdBefore = createdBefore;
      }
    }

    // List exams
    const examService = new ExamManagementService();
    const exams = await examService.listExams(customerId, filters);

    return successResponse({ exams, count: exams.length }, 200);
  } catch (error: any) {
    console.error('Error listing exams:', error);

    return errorResponse('INTERNAL_ERROR', 'Failed to list exams', 500);
  }
}
