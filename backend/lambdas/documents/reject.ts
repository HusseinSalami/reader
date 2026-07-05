// Reject Document Lambda Handler
// POST /v1/documents/{id}/reject

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

    // Parse request body for optional reason
    let reason = '';
    if (event.body) {
      const body = JSON.parse(event.body);
      reason = body.reason || '';
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

    // Update document status to failed (for reprocessing)
    await documentService.updateDocumentStatus(
      authContext.customerId,
      documentId,
      'failed'
    );

    // Get updated document
    const updatedDocument = await documentService.getDocument(
      authContext.customerId,
      documentId
    );

    return successResponse({
      message: 'Document rejected successfully',
      reason,
      document: updatedDocument,
    });
  } catch (error: any) {
    console.error('Error rejecting document:', error);
    return errorResponse('REJECT_FAILED', error.message, 500);
  }
};
