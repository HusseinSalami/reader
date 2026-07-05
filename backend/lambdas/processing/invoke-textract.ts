// Invoke Textract Lambda
// Starts Textract async job for document analysis

import { TextractClient, StartDocumentAnalysisCommand } from '@aws-sdk/client-textract';

const textract = new TextractClient({});

interface InvokeTextractEvent {
  documentId: string;
  customerId: string;
  s3Bucket: string;
  s3Key: string;
  language?: string;
}

export const handler = async (event: InvokeTextractEvent) => {
  console.log('Starting Textract analysis:', event);

  try {
    const command = new StartDocumentAnalysisCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: event.s3Bucket,
          Name: event.s3Key,
        },
      },
      FeatureTypes: ['FORMS', 'TABLES'],
      // Language support
      ...(event.language && { 
        ClientRequestToken: `${event.documentId}-${Date.now()}`,
      }),
    });

    const response = await textract.send(command);

    return {
      ...event,
      textractJobId: response.JobId,
      textractStatus: 'IN_PROGRESS',
    };
  } catch (error: any) {
    console.error('Textract invocation failed:', error);
    throw new Error(`Textract invocation failed: ${error.message}`);
  }
};
