// List Documents Lambda Handler
// GET /v1/documents

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

    // Get query parameters
    const status = event.queryStringParameters?.status as any;
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit)
      : undefined;
    const nextToken = event.queryStringParameters?.nextToken;

    // List documents
    let result;
    if (status) {
      result = await documentService.listDocumentsByStatus(
        authContext.customerId,
        status,
        { limit, nextToken }
      );
    } else {
      result = await documentService.listDocuments(authContext.customerId, {
        limit,
        nextToken,
      });
    }

    return successResponse(result);
  } catch (error: any) {
    console.error('Error listing documents:', error);
    return errorResponse('LIST_FAILED', error.message, 500);
  }
};
