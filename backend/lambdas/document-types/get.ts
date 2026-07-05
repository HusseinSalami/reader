// Get Document Type Lambda Handler

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DocumentTypeService } from './service';
import { successResponse, errorResponse } from '../layers/shared/nodejs/utils';

/**
 * Lambda handler for getting a document type by ID
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    if (!customerId) {
      return errorResponse('UNAUTHORIZED', 'Customer ID not found in authorization context', 401);
    }

    // Extract document type ID from path parameters
    const documentTypeId = event.pathParameters?.id;
    if (!documentTypeId) {
      return errorResponse('INVALID_REQUEST', 'Document type ID is required', 400);
    }

    // Get document type
    const service = new DocumentTypeService();
    const documentType = await service.getDocumentType(customerId, documentTypeId);

    if (!documentType) {
      return errorResponse('NOT_FOUND', `Document type ${documentTypeId} not found`, 404);
    }

    return successResponse(documentType);
  } catch (error: any) {
    console.error('Error getting document type:', error);

    // Handle tenant access errors
    if (error.message.includes('Access denied')) {
      return errorResponse('FORBIDDEN', error.message, 403);
    }

    return errorResponse('INTERNAL_ERROR', 'Failed to get document type', 500);
  }
}
