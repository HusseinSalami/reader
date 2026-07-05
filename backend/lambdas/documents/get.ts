// Get Document Lambda Handler
// GET /v1/documents/{id}

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DocumentService } from './service';
import {
  successResponse,
  errorResponse,
  getAuthContext,
} from '../layers/shared/nodejs/utils';

const documentService = new DocumentService();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract auth context
    const authContext = getAuthContext(event);

    // Get document ID from path
    const documentId = event.pathParameters?.id;
    if (!documentId) {
      return errorResponse('MISSING_ID', 'Document ID is required', 400);
    }

    // Get document
    const document = await documentService.getDocument(
      authContext.customerId,
      documentId
    );

    if (!document) {
      return errorResponse('NOT_FOUND', `Document ${documentId} not found`, 404);
    }

    // Validate tenant access
    if (document.customerId !== authContext.customerId) {
      return errorResponse(
        'FORBIDDEN',
        'Access denied: Document belongs to another customer',
        403
      );
    }

    return successResponse(document);
  } catch (error: any) {
    console.error('Error getting document:', error);
    return errorResponse('GET_FAILED', error.message, 500);
  }
};
