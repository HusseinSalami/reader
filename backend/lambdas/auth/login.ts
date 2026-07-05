// Login Lambda
// Authenticates user and returns JWT tokens

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand, AuthFlowType } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});
const CLIENT_ID = process.env.CLIENT_ID!;

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

interface LoginRequest {
  email: string;
  password: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Login event:', JSON.stringify(event, null, 2));

  try {
    const body: LoginRequest = JSON.parse(event.body || '{}');
    
    if (!body.email || !body.password) {
      return errorResponse('INVALID_INPUT', 'Email and password required', 400);
    }

    const response = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: body.email,
        PASSWORD: body.password,
      },
    }));

    if (!response.AuthenticationResult) {
      return errorResponse('AUTH_FAILED', 'Authentication failed', 401);
    }

    return successResponse({
      accessToken: response.AuthenticationResult.AccessToken,
      idToken: response.AuthenticationResult.IdToken,
      refreshToken: response.AuthenticationResult.RefreshToken,
      expiresIn: response.AuthenticationResult.ExpiresIn,
    });

  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.name === 'NotAuthorizedException') {
      return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }
    
    if (error.name === 'UserNotFoundException') {
      return errorResponse('USER_NOT_FOUND', 'User not found', 404);
    }

    return errorResponse('LOGIN_FAILED', error.message || 'Login failed', 500);
  }
};
