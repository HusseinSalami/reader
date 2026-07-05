// Approve Document Lambda Handler
// POST /v1/documents/{id}/approve

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

    // Update document status to approved
    await documentService.updateDocumentStatus(
      authContext.customerId,
      documentId,
      'approved'
    );

    // Get updated document
    const updatedDocument = await documentService.getDocument(
      authContext.customerId,
      documentId
    );

    return successResponse({
      message: 'Document approved successfully',
      document: updatedDocument,
    });
  } catch (error: any) {
    console.error('Error approving document:', error);
    return errorResponse('APPROVE_FAILED', error.message, 500);
  }
};
