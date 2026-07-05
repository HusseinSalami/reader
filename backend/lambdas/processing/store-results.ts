// Store Results Lambda
// Saves extracted data and validation errors to DynamoDB

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || 'DocumentPlatform';

interface StoreResultsEvent {
  documentId: string;
  customerId: string;
  extractedData: any;
  validationErrors: any[];
  validationPassed: boolean;
}

export const handler = async (event: StoreResultsEvent) => {
  console.log('Storing results:', event.documentId);

  try {
    const status = event.validationPassed ? 'completed' : 'completed';
    const processedAt = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${event.customerId}`,
        SK: `DOCUMENT#${event.documentId}`,
      },
      UpdateExpression: 'SET #status = :status, extractedData = :data, validationErrors = :errors, processedAt = :processedAt, GSI2SK = :gsi2sk',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':data': event.extractedData,
        ':errors': event.validationErrors,
        ':processedAt': processedAt,
        ':gsi2sk': `STATUS#${status}#DOCUMENT#${event.documentId}`,
      },
    }));

    return {
      ...event,
      status,
      processedAt,
      message: 'Results stored successfully',
    };
  } catch (error: any) {
    console.error('Failed to store results:', error);
    throw new Error(`Failed to store results: ${error.message}`);
  }
};
