// Document Upload Lambda Handler
// POST /documents/upload

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

    // Parse request body
    if (!event.body) {
      return errorResponse('MISSING_BODY', 'Request body is required', 400);
    }

    const body = JSON.parse(event.body);

    // Validate required fields
    if (!body.documentTypeId) {
      return errorResponse('MISSING_FIELD', 'documentTypeId is required', 400);
    }

    if (!body.filename) {
      return errorResponse('MISSING_FIELD', 'filename is required', 400);
    }

    if (!body.fileContent) {
      return errorResponse('MISSING_FIELD', 'fileContent is required', 400);
    }

    // Decode base64 file content
    const fileContent = Buffer.from(body.fileContent, 'base64');
    const fileSize = fileContent.length;

    // Upload document
    const result = await documentService.uploadDocument({
      customerId: authContext.customerId,
      documentTypeId: body.documentTypeId,
      templateId: body.templateId,
      filename: body.filename,
      fileContent,
      fileSize,
      language: body.language,
    });

    return successResponse(result, 201);
  } catch (error: any) {
    console.error('Error uploading document:', error);

    if (error.message.includes('Unsupported file format')) {
      return errorResponse('INVALID_FORMAT', error.message, 400);
    }

    if (error.message.includes('File size exceeds')) {
      return errorResponse('FILE_TOO_LARGE', error.message, 400);
    }

    return errorResponse('UPLOAD_FAILED', error.message, 500);
  }
};
