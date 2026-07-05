// Delete Document Type Lambda Handler

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DocumentTypeService } from './service';
import { successResponse, errorResponse } from '../layers/shared/nodejs/utils';

/**
 * Lambda handler for deleting a document type
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

    // Delete document type
    const service = new DocumentTypeService();
    await service.deleteDocumentType(customerId, documentTypeId);

    return successResponse({ message: 'Document type deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting document type:', error);

    // Handle not found errors
    if (error.message.includes('not found')) {
      return errorResponse('NOT_FOUND', error.message, 404);
    }

    // Handle tenant access errors
    if (error.message.includes('Access denied')) {
      return errorResponse('FORBIDDEN', error.message, 403);
    }

    return errorResponse('INTERNAL_ERROR', 'Failed to delete document type', 500);
  }
}
