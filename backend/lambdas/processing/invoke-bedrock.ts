// Invoke Bedrock Lambda
// Uses Claude AI to enhance field extraction

import { 
  BedrockRuntimeClient, 
  InvokeModelCommand 
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Bedrock cross-region inference profiles must be invoked from us-west-2
const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env.TABLE_NAME || 'DocumentReaderTable';

interface InvokeBedrockEvent {
  documentId: string;
  customerId: string;
  documentType: any;
  template: any;
  textractOutput: any;
  extractedData: any;
}

export const handler = async (event: InvokeBedrockEvent) => {
  console.log('Invoking Bedrock for AI-enhanced extraction:', event.documentId);

  try {
    // Build extraction prompt
    const prompt = buildExtractionPrompt(
      event.textractOutput.text,
      event.documentType.schema,
      event.documentType.name
    );

    // Invoke Claude model using cross-region inference profile
    const command = new InvokeModelCommand({
      modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      }),
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Track Bedrock usage for billing
    await trackBedrockUsage(event.customerId, responseBody);
    
    // Parse Claude response
    const bedrockValues = parseClaudeResponse(responseBody.content[0].text);

    // Merge with Textract values (Bedrock takes priority)
    const mergedData = mergeExtractedValues(
      event.extractedData,
      bedrockValues,
      event.documentType.schema.fields
    );

    return {
      ...event,
      extractedData: mergedData,
      bedrockUsed: true,
    };
  } catch (error: any) {
    console.error('Bedrock invocation failed:', error);
    // Don't fail the pipeline, just log and continue with Textract-only data
    return {
      ...event,
      bedrockError: error.message,
      bedrockUsed: false,
    };
  }
};

function buildExtractionPrompt(
  documentText: string,
  schema: any,
  documentTypeName: string
): string {
  const fields = schema.fields.map((f: any) => 
    `- ${f.name} (${f.dataType})${f.description ? ': ' + f.description : ''}`
  ).join('\n');

  return `You are a document data extraction assistant. Extract the following fields from the document text below.

Document Type: ${documentTypeName}

Fields to extract:
${fields}

Document Text:
${documentText}

Return the extracted values as JSON in this format:
{
  "fieldName1": "extractedValue1",
  "fieldName2": "extractedValue2"
}

If a field cannot be found, use null as the value. Only return the JSON, no other text.`;
}

function parseClaudeResponse(responseText: string): any {
  try {
    // Extract JSON from response (Claude might wrap it in markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error('Failed to parse Claude response:', error);
    return {};
  }
}

function mergeExtractedValues(
  textractData: any,
  bedrockValues: any,
  fields: any[]
): any {
  const merged = { ...textractData };

  for (const field of fields) {
    const bedrockValue = bedrockValues[field.name];
    
    if (bedrockValue !== undefined && bedrockValue !== null) {
      merged.fields[field.fieldId] = {
        fieldId: field.fieldId,
        value: bedrockValue,
        confidence: 0.9, // Bedrock doesn't provide confidence scores
        source: 'bedrock',
        corrected: false,
        needsReview: true, // Flag Bedrock values for review
      };
    }
  }

  return merged;
}

async function trackBedrockUsage(customerId: string, responseBody: any): Promise<void> {
  try {
    const inputTokens = responseBody.usage?.input_tokens || 0;
    const outputTokens = responseBody.usage?.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    
    // Update customer usage counter in DynamoDB
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: 'USAGE',
      },
      UpdateExpression: `
        SET 
          bedrockInvocations = if_not_exists(bedrockInvocations, :zero) + :one,
          bedrockInputTokens = if_not_exists(bedrockInputTokens, :zero) + :inputTokens,
          bedrockOutputTokens = if_not_exists(bedrockOutputTokens, :zero) + :outputTokens,
          bedrockTotalTokens = if_not_exists(bedrockTotalTokens, :zero) + :totalTokens,
          lastBedrockUsage = :timestamp,
          updatedAt = :timestamp
      `,
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
        ':inputTokens': inputTokens,
        ':outputTokens': outputTokens,
        ':totalTokens': totalTokens,
        ':timestamp': new Date().toISOString(),
      },
    });
    
    await docClient.send(command);
    
    console.log(`Tracked Bedrock usage for customer ${customerId}:`, {
      inputTokens,
      outputTokens,
      totalTokens,
    });
  } catch (error) {
    console.error('Failed to track Bedrock usage:', error);
    // Don't fail the pipeline if usage tracking fails
  }
}
