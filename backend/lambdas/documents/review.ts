// Review Document Lambda Handler
// PUT /v1/documents/{id}/review

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

    // Parse request body
    if (!event.body) {
      return errorResponse('MISSING_BODY', 'Request body is required', 400);
    }

    const body = JSON.parse(event.body);

    // Validate extracted data
    if (!body.extractedData) {
      return errorResponse(
        'MISSING_FIELD',
        'extractedData is required',
        400
      );
    }

    // Get existing document
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

    // Store updated extracted data
    await documentService.storeExtractedData(
      authContext.customerId,
      documentId,
      body.extractedData,
      body.validationErrors || []
    );

    // Get updated document
    const updatedDocument = await documentService.getDocument(
      authContext.customerId,
      documentId
    );

    return successResponse(updatedDocument);
  } catch (error: any) {
    console.error('Error reviewing document:', error);
    return errorResponse('REVIEW_FAILED', error.message, 500);
  }
};
