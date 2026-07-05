// Generate Presigned Upload URL Lambda
// Creates presigned S3 URL for document upload

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BUCKET_NAME = process.env.BUCKET_NAME!;
const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE!;

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

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

interface UploadUrlRequest {
  fileName: string;
  fileType: string;
  documentTypeId?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Upload URL event:', JSON.stringify(event, null, 2));

  try {
    const customerId = event.requestContext?.authorizer?.customerId;
    const userId = event.requestContext?.authorizer?.userId;
    
    if (!customerId || !userId) {
      return errorResponse('UNAUTHORIZED', 'No customer context found', 401);
    }

    const body: UploadUrlRequest = JSON.parse(event.body || '{}');
    
    if (!body.fileName || !body.fileType) {
      return errorResponse('INVALID_INPUT', 'fileName and fileType required', 400);
    }

    const documentId = uuidv4();
    const uploadedAt = new Date().toISOString();
    const sanitizedFilename = sanitizeFilename(body.fileName);
    const s3Key = `${customerId}/documents/${documentId}/${sanitizedFilename}`;

    // Generate presigned URL
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: body.fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Create document record
    const document = {
      customerId,
      sk: `DOC#${uploadedAt}#${documentId}`,
      documentId,
      documentTypeId: body.documentTypeId || 'UNTYPED',
      fileName: body.fileName,
      fileType: body.fileType,
      s3Key,
      language: 'en',
      status: 'UPLOADED',
      uploadedBy: userId,
      uploadedAt,
      customerStatus: `${customerId}#UPLOADED`,
      customerDocType: body.documentTypeId ? `${customerId}#${body.documentTypeId}` : undefined,
    };

    await docClient.send(new PutCommand({
      TableName: DOCUMENTS_TABLE,
      Item: document,
    }));

    return successResponse({
      documentId,
      uploadUrl,
      s3Key,
      expiresIn: 3600,
    }, 201);

  } catch (error: any) {
    console.error('Upload URL error:', error);
    return errorResponse('UPLOAD_FAILED', error.message || 'Failed to generate upload URL', 500);
  }
};
