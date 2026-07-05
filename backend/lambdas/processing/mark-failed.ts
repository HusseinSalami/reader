// Mark Failed Lambda
// Updates document status to 'failed' when processing fails

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env.TABLE_NAME || 'DocumentPlatform';

interface MarkFailedEvent {
  documentId: string;
  customerId: string;
  error?: any;
  errorMessage?: string;
}

export const handler = async (event: MarkFailedEvent) => {
  console.log('Marking document as failed:', event.documentId);

  try {
    const errorMessage = event.errorMessage || 
                        event.error?.errorMessage || 
                        event.error?.message || 
                        'Processing failed';

    // Update document status to failed
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${event.customerId}`,
        SK: `DOCUMENT#${event.documentId}`,
      },
      UpdateExpression: 'SET #status = :status, #error = :error, #processedAt = :processedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#error': 'errorMessage',
        '#processedAt': 'processedAt',
      },
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':error': errorMessage,
        ':processedAt': new Date().toISOString(),
      },
    }));

    console.log('Document marked as failed successfully');

    return {
      ...event,
      status: 'failed',
      errorMessage,
    };
  } catch (error: any) {
    console.error('Failed to mark document as failed:', error);
    // Don't throw - we want the state machine to complete even if this fails
    return {
      ...event,
      status: 'failed',
      errorMessage: 'Failed to update document status',
    };
  }
};
