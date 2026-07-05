// Pre-processing Lambda
// Simplified version - passes through document without image processing
// Textract can handle orientation detection and multi-page PDFs automatically

import { S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });

interface PreProcessEvent {
  documentId: string;
  customerId: string;
  s3Bucket: string;
  s3Key: string;
  filename: string;
}

interface ProcessedPage {
  pageNumber: number;
  s3Key: string;
  width: number;
  height: number;
  rotated: boolean;
  rotationAngle?: number;
}

export const handler = async (event: PreProcessEvent) => {
  console.log('Pre-processing document:', event.documentId);

  try {
    // Simplified pre-processing - just pass through the document
    // Textract handles orientation detection and multi-page PDFs automatically
    
    const processedPages: ProcessedPage[] = [{
      pageNumber: 1,
      s3Key: event.s3Key, // Use original document
      width: 0,
      height: 0,
      rotated: false,
    }];
    
    console.log('Pre-processing complete - using original document');
    
    return {
      ...event,
      processedPages,
      pageCount: processedPages.length,
    };
  } catch (error: any) {
    console.error('Pre-processing failed:', error);
    throw new Error(`Pre-processing failed: ${error.message}`);
  }
};
