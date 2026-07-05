// Update Customer Profile Lambda
// Updates customer information

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE!;

function successResponse<T>(data: T, statusCode: number = 200): any {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({ success: true, data }),
  };
}

function errorResponse(code: string, message: string, statusCode: number = 400): any {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({ success: false, error: { code, message } }),
  };
}

interface UpdateProfileRequest {
  companyName?: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  };
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Update profile event:', JSON.stringify(event, null, 2));

  try {
    const customerId = event.requestContext?.authorizer?.customerId;
    
    if (!customerId) {
      return errorResponse('UNAUTHORIZED', 'No customer context found', 401);
    }

    const body: UpdateProfileRequest = JSON.parse(event.body || '{}');
    
    if (!body.companyName && !body.contactInfo) {
      return errorResponse('INVALID_INPUT', 'No fields to update', 400);
    }

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (body.companyName) {
      updateExpressions.push('#companyName = :companyName');
      expressionAttributeNames['#companyName'] = 'companyName';
      expressionAttributeValues[':companyName'] = body.companyName;
    }

    if (body.contactInfo) {
      updateExpressions.push('#contactInfo = :contactInfo');
      expressionAttributeNames['#contactInfo'] = 'contactInfo';
      expressionAttributeValues[':contactInfo'] = body.contactInfo;
    }

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: CUSTOMERS_TABLE,
      Key: {
        customerId,
        sk: 'CUSTOMER#METADATA',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }));

    return successResponse({ message: 'Profile updated successfully' });

  } catch (error: any) {
    console.error('Update profile error:', error);
    return errorResponse('UPDATE_FAILED', error.message || 'Failed to update profile', 500);
  }
};
