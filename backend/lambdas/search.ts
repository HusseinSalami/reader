import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = event.queryStringParameters || {};
    const searchTerm = queryParams.q;
    const limit = parseInt(queryParams.limit || '20');

    if (!searchTerm) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Search term (q) is required' }),
      };
    }

    // Scan with filter (for production, consider using OpenSearch or similar)
    const result = await dynamoClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'contains(extractedText, :searchTerm) OR contains(fileName, :searchTerm)',
      ExpressionAttributeValues: {
        ':searchTerm': searchTerm,
      },
      Limit: limit,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        documents: result.Items || [],
        count: result.Items?.length || 0,
        searchTerm,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
