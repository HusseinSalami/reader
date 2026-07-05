// Customer Registration Lambda
// Creates a new customer account and admin user

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE!;
const USER_POOL_ID = process.env.USER_POOL_ID!;

// Inline utility functions
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

function now(): string {
  return new Date().toISOString();
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function getTierLimits(tier: 'FREE' | 'PRO' | 'ENTERPRISE') {
  switch (tier) {
    case 'FREE':
      return {
        maxDocumentsPerMonth: 100,
        maxUsers: 1,
        apiEnabled: false,
        webhooksEnabled: false,
        mlEnabled: false,
        languageSupport: ['en'],
      };
    case 'PRO':
      return {
        maxDocumentsPerMonth: 1000,
        maxUsers: 5,
        apiEnabled: true,
        webhooksEnabled: true,
        mlEnabled: false,
        languageSupport: ['en', 'fr', 'ar'],
      };
    case 'ENTERPRISE':
      return {
        maxDocumentsPerMonth: -1,
        maxUsers: -1,
        apiEnabled: true,
        webhooksEnabled: true,
        mlEnabled: true,
        languageSupport: ['en', 'fr', 'ar'],
      };
  }
}

interface RegisterRequest {
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  subscriptionTier?: 'FREE' | 'PRO' | 'ENTERPRISE';
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Register event:', JSON.stringify(event, null, 2));

  try {
    const body: RegisterRequest = JSON.parse(event.body || '{}');
    
    if (!body.companyName || !body.email || !body.firstName || !body.lastName || !body.password) {
      return errorResponse('INVALID_INPUT', 'Missing required fields', 400);
    }

    if (!isValidEmail(body.email)) {
      return errorResponse('INVALID_EMAIL', 'Invalid email format', 400);
    }

    // Validate password strength
    if (body.password.length < 8) {
      return errorResponse('WEAK_PASSWORD', 'Password must be at least 8 characters', 400);
    }

    const customerId = uuidv4();
    const subscriptionTier = body.subscriptionTier || 'FREE';
    const tierLimits = getTierLimits(subscriptionTier);

    const customer = {
      customerId,
      sk: 'CUSTOMER#METADATA',
      companyName: body.companyName,
      subscriptionTier,
      status: 'ACTIVE',
      createdAt: now(),
      settings: tierLimits,
      contactInfo: { email: body.email },
    };

    await docClient.send(new PutCommand({
      TableName: CUSTOMERS_TABLE,
      Item: customer,
      ConditionExpression: 'attribute_not_exists(customerId)',
    }));

    // Create Cognito user with permanent password
    const createUserResponse = await cognitoClient.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: body.email,
      UserAttributes: [
        { Name: 'email', Value: body.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: body.firstName },
        { Name: 'family_name', Value: body.lastName },
        { Name: 'custom:customerId', Value: customerId },
        { Name: 'custom:role', Value: 'ADMIN' },
      ],
      TemporaryPassword: body.password,
      MessageAction: 'SUPPRESS', // Don't send email
    }));

    const userId = createUserResponse.User?.Username;

    // Set permanent password (skip force change password)
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: body.email,
      Password: body.password,
      Permanent: true,
    }));

    await cognitoClient.send(new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: body.email,
      GroupName: 'ADMIN',
    }));

    await docClient.send(new PutCommand({
      TableName: CUSTOMERS_TABLE,
      Item: {
        customerId,
        sk: `USER#${userId}`,
        userId,
        email: body.email,
        role: 'ADMIN',
        permissions: ['*'],
        createdAt: now(),
      },
    }));

    console.log('Customer registered:', customerId);

    return successResponse({
      customerId,
      companyName: body.companyName,
      subscriptionTier,
      adminEmail: body.email,
      message: 'Customer registered successfully. You can now sign in.',
    }, 201);

  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      return errorResponse('CUSTOMER_EXISTS', 'Customer already exists', 409);
    }
    
    if (error.name === 'UsernameExistsException') {
      return errorResponse('EMAIL_EXISTS', 'Email already registered', 409);
    }

    return errorResponse(
      'REGISTRATION_FAILED',
      error.message || 'Failed to register customer',
      500
    );
  }
};
