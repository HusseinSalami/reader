// List Document Types Lambda Handler

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DocumentTypeService } from './service';
import { successResponse, errorResponse } from '../layers/shared/nodejs/utils';

/**
 * Lambda handler for listing document types for a customer
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    if (!customerId) {
      return errorResponse('UNAUTHORIZED', 'Customer ID not found in authorization context', 401);
    }

    // Parse query parameters
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : undefined;
    const nextToken = event.queryStringParameters?.nextToken;

    // List document types
    const service = new DocumentTypeService();
    const result = await service.listDocumentTypes(customerId, { limit, nextToken });

    return successResponse({
      items: result.items,
      nextToken: result.nextToken,
      count: result.items.length,
    });
  } catch (error: any) {
    console.error('Error listing document types:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to list document types', 500);
  }
}
