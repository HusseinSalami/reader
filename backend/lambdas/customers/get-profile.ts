// Get Customer Profile Lambda
// Returns customer information for authenticated user

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

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

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Get profile event:', JSON.stringify(event, null, 2));

  try {
    // Extract customerId from authorizer context
    const customerId = event.requestContext?.authorizer?.customerId;
    
    if (!customerId) {
      return errorResponse('UNAUTHORIZED', 'No customer context found', 401);
    }

    // Get customer record
    const result = await docClient.send(new GetCommand({
      TableName: CUSTOMERS_TABLE,
      Key: {
        customerId,
        sk: 'CUSTOMER#METADATA',
      },
    }));

    if (!result.Item) {
      return errorResponse('NOT_FOUND', 'Customer not found', 404);
    }

    // Remove sensitive data
    const customer = { ...result.Item };
    delete customer.sk;

    return successResponse(customer);

  } catch (error: any) {
    console.error('Get profile error:', error);
    return errorResponse('FETCH_FAILED', error.message || 'Failed to fetch profile', 500);
  }
};
