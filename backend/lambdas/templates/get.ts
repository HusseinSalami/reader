// Get Template Lambda Handler
// Phase 2: Document Type & Template Management

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TemplateService } from './service';

/**
 * Lambda handler for getting a template by ID
 * GET /templates/{id}
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

    // Extract template ID from path parameters
    const templateId = event.pathParameters?.id;
    if (!templateId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Template ID is required',
          },
        }),
      };
    }

    // Get template
    const service = new TemplateService();
    const template = await service.getTemplate(customerId, templateId);

    if (!template) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: `Template ${templateId} not found`,
          },
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: template,
      }),
    };
  } catch (error) {
    console.error('Error getting template:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: error.message,
            },
          }),
        };
      }
    }

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
