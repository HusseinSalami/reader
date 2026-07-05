// Lambda Authorizer for API Gateway
// Validates JWT tokens from Cognito and injects customer context

import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;

// Create JWT verifier for ID tokens (contains custom attributes)
const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id',
  clientId: CLIENT_ID,
});

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer event:', JSON.stringify(event, null, 2));

  try {
    // Extract token from Authorization header
    const token = event.authorizationToken?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No token provided');
    }

    // Verify JWT token
    const payload = await verifier.verify(token);
    
    console.log('Token payload:', JSON.stringify(payload, null, 2));

    // Extract custom attributes
    const customerId = payload['custom:customerId'] as string;
    const role = payload['custom:role'] as string;
    const email = payload.email as string;
    const userId = payload.sub;

    if (!customerId) {
      throw new Error('No customerId in token');
    }

    // Generate policy
    const policy = generatePolicy(
      userId,
      'Allow',
      event.methodArn,
      {
        customerId,
        userId,
        role: role || 'USER',
        email,
      }
    );

    console.log('Generated policy:', JSON.stringify(policy, null, 2));
    return policy;

  } catch (error) {
    console.error('Authorization error:', error);
    
    // Return deny policy
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>
): APIGatewayAuthorizerResult {
  // Use wildcard to allow access to all methods in the API
  // This prevents issues with policy caching when accessing different endpoints
  const resourceParts = resource.split('/');
  const wildcardResource = resourceParts.slice(0, 2).join('/') + '/*';
  
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: wildcardResource,
        },
      ],
    },
    context,
  };
}
