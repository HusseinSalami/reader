// List Templates Lambda Handler
// Phase 2: Document Type & Template Management

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TemplateService } from './service';

/**
 * Lambda handler for listing templates
 * GET /templates
 * Query parameters:
 *   - documentTypeId: Filter by document type (optional)
 *   - limit: Maximum number of results (optional)
 *   - nextToken: Pagination token (optional)
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    if (!customerId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing customer ID in authorization context',
          },
        }),
      };
    }

    // Extract query parameters
    const documentTypeId = event.queryStringParameters?.documentTypeId;
    const limitStr = event.queryStringParameters?.limit;
    const nextToken = event.queryStringParameters?.nextToken;

    // Parse limit
    let limit: number | undefined;
    if (limitStr) {
      limit = parseInt(limitStr, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Limit must be between 1 and 100',
            },
          }),
        };
      }
    }

    // List templates
    const service = new TemplateService();
    const result = await service.listTemplates(customerId, {
      documentTypeId,
      limit,
      nextToken,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          items: result.items,
          nextToken: result.nextToken,
          count: result.items.length,
        },
      }),
    };
  } catch (error) {
    console.error('Error listing templates:', error);

    // Generic error
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      }),
    };
  }
};
