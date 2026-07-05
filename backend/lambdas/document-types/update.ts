// Update Document Type Lambda Handler

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DocumentTypeService, UpdateDocumentTypeInput } from './service';
import { successResponse, errorResponse } from '../layers/shared/nodejs/utils';

/**
 * Lambda handler for updating a document type
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

    // Parse request body
    if (!event.body) {
      return errorResponse('INVALID_REQUEST', 'Request body is required', 400);
    }

    const input: UpdateDocumentTypeInput = JSON.parse(event.body);

    // Validate at least one field is provided
    if (!input.name && !input.description && !input.schema) {
      return errorResponse('VALIDATION_ERROR', 'At least one field (name, description, or schema) must be provided', 400);
    }

    // Update document type
    const service = new DocumentTypeService();
    const documentType = await service.updateDocumentType(customerId, documentTypeId, input);

    return successResponse(documentType);
  } catch (error: any) {
    console.error('Error updating document type:', error);

    // Handle not found errors
    if (error.message.includes('not found')) {
      return errorResponse('NOT_FOUND', error.message, 404);
    }

    // Handle duplicate name errors
    if (error.message.includes('already exists')) {
      return errorResponse('DUPLICATE_NAME', error.message, 409);
    }

    // Handle validation errors
    if (error.message.includes('Invalid') || error.message.includes('Duplicate')) {
      return errorResponse('VALIDATION_ERROR', error.message, 400);
    }

    // Handle tenant access errors
    if (error.message.includes('Access denied')) {
      return errorResponse('FORBIDDEN', error.message, 403);
    }

    return errorResponse('INTERNAL_ERROR', 'Failed to update document type', 500);
  }
}
