import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  TextractClient,
  DetectDocumentTextCommand,
  AnalyzeDocumentCommand,
  FeatureType,
} from '@aws-sdk/client-textract';

const s3Client = new S3Client({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const textractClient = new TextractClient({});

const TABLE_NAME = process.env.TABLE_NAME!;

interface ExtractedData {
  text: string;
  lines: string[];
  words: string[];
  keyValuePairs?: Record<string, string>;
  tables?: any[];
  confidence: number;
}

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // Extract documentId from key (uploads/{documentId}/{fileName})
    const documentId = key.split('/')[1];

    try {
      console.log(`Processing document: ${documentId}`);

      // Update status to PROCESSING
      await updateDocumentStatus(documentId, 'PROCESSING');

      // Detect document text
      const textData = await extractText(bucket, key);

      // Analyze document for forms and tables
      const analysisData = await analyzeDocument(bucket, key);

      // Combine results
      const extractedData: ExtractedData = {
        text: textData.text,
        lines: textData.lines,
        words: textData.words,
        keyValuePairs: analysisData.keyValuePairs,
        tables: analysisData.tables,
        confidence: textData.confidence,
      };

      // Extract metadata
      const metadata = extractMetadata(extractedData);

      // Update document with extracted data
      await dynamoClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { documentId, version: 1 },
        UpdateExpression: 'SET #status = :status, extractedText = :text, extractedData = :data, metadata = :metadata, processedAt = :processedAt, updatedAt = :updatedAt, wordCount = :wordCount, pageCount = :pageCount',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'COMPLETED',
          ':text': extractedData.text,
          ':data': extractedData,
          ':metadata': metadata,
          ':processedAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString(),
          ':wordCount': extractedData.words.length,
          ':pageCount': 1,
        },
      }));

      console.log(`Successfully processed document: ${documentId}`);
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      await updateDocumentStatus(documentId, 'FAILED', error instanceof Error ? error.message : 'Unknown error');
    }
  }
};

async function extractText(bucket: string, key: string) {
  const command = new DetectDocumentTextCommand({
    Document: {
      S3Object: { Bucket: bucket, Name: key },
    },
  });

  const response = await textractClient.send(command);
  const blocks = response.Blocks || [];

  const lines: string[] = [];
  const words: string[] = [];
  let fullText = '';
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const block of blocks) {
    if (block.BlockType === 'LINE' && block.Text) {
      lines.push(block.Text);
      fullText += block.Text + '\n';
    }
    if (block.BlockType === 'WORD' && block.Text) {
      words.push(block.Text);
    }
    if (block.Confidence) {
      totalConfidence += block.Confidence;
      confidenceCount++;
    }
  }

  return {
    text: fullText.trim(),
    lines,
    words,
    confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
  };
}

async function analyzeDocument(bucket: string, key: string) {
  try {
    const command = new AnalyzeDocumentCommand({
      Document: {
        S3Object: { Bucket: bucket, Name: key },
      },
      FeatureTypes: [FeatureType.FORMS, FeatureType.TABLES],
    });

    const response = await textractClient.send(command);
    const blocks = response.Blocks || [];

    // Extract key-value pairs
    const keyValuePairs: Record<string, string> = {};
    const keyMap = new Map();
    const valueMap = new Map();
    const blockMap = new Map();

    blocks.forEach(block => {
      if (block.Id) {
        blockMap.set(block.Id, block);
        if (block.BlockType === 'KEY_VALUE_SET') {
          if (block.EntityTypes?.includes('KEY')) {
            keyMap.set(block.Id, block);
          } else if (block.EntityTypes?.includes('VALUE')) {
            valueMap.set(block.Id, block);
          }
        }
      }
    });

    keyMap.forEach((keyBlock, keyId) => {
      const valueBlock = findValue(keyBlock, valueMap);
      if (valueBlock) {
        const key = getText(keyBlock, blockMap);
        const value = getText(valueBlock, blockMap);
        if (key && value) {
          keyValuePairs[key] = value;
        }
      }
    });

    // Extract tables (simplified)
    const tables = blocks
      .filter(block => block.BlockType === 'TABLE')
      .map(table => ({ id: table.Id, confidence: table.Confidence }));

    return { keyValuePairs, tables };
  } catch (error) {
    console.warn('Document analysis failed, continuing with text extraction only:', error);
    return { keyValuePairs: {}, tables: [] };
  }
}

function findValue(keyBlock: any, valueMap: Map<string, any>) {
  if (!keyBlock.Relationships) return null;
  for (const relationship of keyBlock.Relationships) {
    if (relationship.Type === 'VALUE') {
      for (const valueId of relationship.Ids || []) {
        return valueMap.get(valueId);
      }
    }
  }
  return null;
}

function getText(block: any, blockMap: Map<string, any>): string {
  if (!block.Relationships) return '';
  let text = '';
  for (const relationship of block.Relationships) {
    if (relationship.Type === 'CHILD') {
      for (const childId of relationship.Ids || []) {
        const childBlock = blockMap.get(childId);
        if (childBlock?.BlockType === 'WORD' && childBlock.Text) {
          text += childBlock.Text + ' ';
        }
      }
    }
  }
  return text.trim();
}

function extractMetadata(data: ExtractedData) {
  const metadata: any = {
    extractedAt: new Date().toISOString(),
    confidence: data.confidence,
    hasKeyValuePairs: Object.keys(data.keyValuePairs || {}).length > 0,
    hasTables: (data.tables || []).length > 0,
  };

  // Extract dates
  const dateRegex = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g;
  const dates = data.text.match(dateRegex);
  if (dates && dates.length > 0) {
    metadata.detectedDates = dates;
  }

  // Extract emails
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = data.text.match(emailRegex);
  if (emails && emails.length > 0) {
    metadata.detectedEmails = emails;
  }

  // Extract phone numbers
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  const phones = data.text.match(phoneRegex);
  if (phones && phones.length > 0) {
    metadata.detectedPhones = phones;
  }

  return metadata;
}

async function updateDocumentStatus(documentId: string, status: string, errorMessage?: string) {
  const updateExpression = errorMessage
    ? 'SET #status = :status, errorMessage = :error, updatedAt = :updatedAt'
    : 'SET #status = :status, updatedAt = :updatedAt';

  const expressionAttributeValues: any = {
    ':status': status,
    ':updatedAt': new Date().toISOString(),
  };

  if (errorMessage) {
    expressionAttributeValues[':error'] = errorMessage;
  }

  await dynamoClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { documentId, version: 1 },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}
