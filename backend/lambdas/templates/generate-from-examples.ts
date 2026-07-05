import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const s3Client = new S3Client({});
const textractClient = new TextractClient({});
// Bedrock cross-region inference profiles must be invoked from us-west-2
const bedrockClient = new BedrockRuntimeClient({ region: 'us-west-2' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Use cross-region inference profile instead of direct model ID
// This is required for newer Claude models
const BEDROCK_MODEL_ID = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
const MAX_TOKENS = 4000; // Keep it reasonable for cost control
const COST_PER_INPUT_TOKEN = 0.003 / 1000; // $3 per million input tokens
const COST_PER_OUTPUT_TOKEN = 0.015 / 1000; // $15 per million output tokens
const FREE_TIER_MONTHLY_LIMIT = 10.00; // Conservative limit for free tier

interface GenerateTemplateRequest {
  documentTypeId: string;
  documentTypeName: string;
  documentTypeSchema: {
    fields: Array<{
      fieldId: string;
      name: string;
      dataType: string;
      required: boolean;
      description?: string;
    }>;
  };
  sampleDocuments: Array<{
    filename: string;
    fileContent: string; // base64
  }>;
  templateName?: string;
  templateDescription?: string;
}

interface ExtractionRule {
  ruleId: string;
  fieldId: string;
  method: 'textract_kv' | 'regex' | 'table';
  params: Record<string, any>;
  confidence?: number;
  reasoning?: string;
}

interface CostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  withinBudget: boolean;
  monthlyUsage?: number;
}

/**
 * Lambda handler for AI-powered template generation from example documents
 * 
 * Cost Control Features:
 * - Estimates cost before making Bedrock call
 * - Tracks monthly usage in DynamoDB
 * - Rejects requests that would exceed budget
 * - Uses efficient prompts to minimize tokens
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const customerId = event.requestContext.authorizer?.customerId;
    if (!customerId) {
      return {
        statusCode: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const request: GenerateTemplateRequest = JSON.parse(event.body || '{}');

    // Validate request
    if (!request.documentTypeId || !request.sampleDocuments || request.sampleDocuments.length === 0) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Missing required fields: documentTypeId and sampleDocuments' 
        }),
      };
    }

    // Limit to 3 sample documents for cost control
    if (request.sampleDocuments.length > 3) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Maximum 3 sample documents allowed for template generation' 
        }),
      };
    }

    console.log(`Generating template for customer ${customerId}, documentType ${request.documentTypeId}`);

    // Step 1: Check monthly usage and estimate cost
    const costCheck = await checkCostAndUsage(customerId, request);
    if (!costCheck.withinBudget) {
      return {
        statusCode: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Monthly AI usage limit reached',
          details: {
            monthlyUsage: costCheck.monthlyUsage,
            limit: FREE_TIER_MONTHLY_LIMIT,
            estimatedCost: costCheck.estimatedCost,
          }
        }),
      };
    }

    // Step 2: Upload sample documents to S3 and analyze with Textract
    const s3Bucket = process.env.DOCUMENT_BUCKET!;
    const documentAnalyses = await Promise.all(
      request.sampleDocuments.map(async (doc, idx) => {
        // Upload to S3
        const s3Key = `${customerId}/samples/${Date.now()}-${idx}-${doc.filename}`;
        const buffer = Buffer.from(doc.fileContent, 'base64');
        
        await s3Client.send(new PutObjectCommand({
          Bucket: s3Bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: getContentType(doc.filename),
        }));

        // Analyze with Textract
        return analyzeDocument(s3Bucket, s3Key);
      })
    );

    // Step 3: Generate extraction rules using Bedrock
    const generatedRules = await generateRulesWithBedrock(
      request.documentTypeSchema,
      documentAnalyses,
      request.documentTypeName
    );

    // Step 4: Track actual usage
    await trackUsage(customerId, generatedRules.usage);

    // Step 5: Return generated template
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        template: {
          name: request.templateName || `AI-Generated ${request.documentTypeName} Template`,
          description: request.templateDescription || 
            `Automatically generated template based on ${request.sampleDocuments.length} sample document(s)`,
          documentTypeId: request.documentTypeId,
          rules: generatedRules.rules,
          aiEnhanced: true,
          metadata: {
            generatedAt: new Date().toISOString(),
            sampleCount: request.sampleDocuments.length,
            confidence: generatedRules.overallConfidence,
            cost: generatedRules.usage.cost,
          }
        },
        usage: {
          inputTokens: generatedRules.usage.inputTokens,
          outputTokens: generatedRules.usage.outputTokens,
          cost: generatedRules.usage.cost,
          monthlyUsage: costCheck.monthlyUsage! + generatedRules.usage.cost,
          remainingBudget: FREE_TIER_MONTHLY_LIMIT - (costCheck.monthlyUsage! + generatedRules.usage.cost),
        }
      }),
    };

  } catch (error: any) {
    console.error('Error generating template:', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Failed to generate template',
        message: error.message 
      }),
    };
  }
};

/**
 * Check if request is within budget and estimate cost
 */
async function checkCostAndUsage(
  customerId: string, 
  request: GenerateTemplateRequest
): Promise<CostEstimate> {
  try {
    // Get current monthly usage
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const result = await dynamoClient.send(new UpdateCommand({
      TableName: process.env.TABLE_NAME!,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `AI_USAGE#${monthKey}`,
      },
      UpdateExpression: 'SET #month = if_not_exists(#month, :month), #cost = if_not_exists(#cost, :zero)',
      ExpressionAttributeNames: {
        '#month': 'month',
        '#cost': 'totalCost',
      },
      ExpressionAttributeValues: {
        ':month': monthKey,
        ':zero': 0,
      },
      ReturnValues: 'ALL_NEW',
    }));

    const currentUsage = result.Attributes?.totalCost || 0;

    // Estimate tokens for this request
    // Rough estimate: 1000 tokens per document analysis + 500 for schema + 2000 for response
    const estimatedInputTokens = (request.sampleDocuments.length * 1000) + 500;
    const estimatedOutputTokens = 2000;
    const estimatedCost = 
      (estimatedInputTokens * COST_PER_INPUT_TOKEN) + 
      (estimatedOutputTokens * COST_PER_OUTPUT_TOKEN);

    const withinBudget = (currentUsage + estimatedCost) <= FREE_TIER_MONTHLY_LIMIT;

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCost,
      withinBudget,
      monthlyUsage: currentUsage,
    };

  } catch (error) {
    console.error('Error checking cost:', error);
    // Fail safe - allow if we can't check
    return {
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedCost: 0,
      withinBudget: true,
      monthlyUsage: 0,
    };
  }
}

/**
 * Track actual usage after Bedrock call
 */
async function trackUsage(customerId: string, usage: any): Promise<void> {
  try {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await dynamoClient.send(new UpdateCommand({
      TableName: process.env.TABLE_NAME!,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `AI_USAGE#${monthKey}`,
      },
      UpdateExpression: `
        ADD #cost :cost, #calls :one, #inputTokens :inputTokens, #outputTokens :outputTokens
        SET #lastUsed = :now, #month = :month
      `,
      ExpressionAttributeNames: {
        '#cost': 'totalCost',
        '#calls': 'totalCalls',
        '#inputTokens': 'totalInputTokens',
        '#outputTokens': 'totalOutputTokens',
        '#lastUsed': 'lastUsedAt',
        '#month': 'month',
      },
      ExpressionAttributeValues: {
        ':cost': usage.cost,
        ':one': 1,
        ':inputTokens': usage.inputTokens,
        ':outputTokens': usage.outputTokens,
        ':now': now.toISOString(),
        ':month': monthKey,
      },
    }));

    console.log(`Tracked usage for ${customerId}: $${usage.cost.toFixed(4)}`);
  } catch (error) {
    console.error('Error tracking usage:', error);
    // Don't fail the request if tracking fails
  }
}

/**
 * Analyze document with Textract
 */
async function analyzeDocument(bucket: string, key: string): Promise<any> {
  try {
    const result = await textractClient.send(new AnalyzeDocumentCommand({
      Document: {
        S3Object: { Bucket: bucket, Name: key }
      },
      FeatureTypes: ['FORMS', 'TABLES'],
    }));

    // Extract key-value pairs
    const keyValuePairs: Array<{ key: string; value: string; confidence: number }> = [];
    const tables: Array<any> = [];

    const blocks = result.Blocks || [];
    const blockMap = new Map(blocks.filter(b => b.Id).map(b => [b.Id!, b]));

    // Extract key-value pairs
    blocks.filter(b => b.BlockType === 'KEY_VALUE_SET' && b.EntityTypes?.includes('KEY')).forEach(keyBlock => {
      const keyText = getBlockText(keyBlock, blockMap);
      const valueBlock = keyBlock.Relationships?.find(r => r.Type === 'VALUE')?.Ids?.[0];
      const valueText = valueBlock ? getBlockText(blockMap.get(valueBlock), blockMap) : '';
      
      if (keyText && valueText) {
        keyValuePairs.push({
          key: keyText,
          value: valueText,
          confidence: keyBlock.Confidence || 0,
        });
      }
    });

    // Extract tables
    blocks.filter(b => b.BlockType === 'TABLE').forEach(tableBlock => {
      const cells = tableBlock.Relationships?.find(r => r.Type === 'CHILD')?.Ids || [];
      const tableData: any = { rows: [] };
      
      cells.forEach(cellId => {
        const cell = blockMap.get(cellId);
        if (cell && cell.BlockType === 'CELL') {
          const rowIndex = (cell.RowIndex || 1) - 1;
          const colIndex = (cell.ColumnIndex || 1) - 1;
          
          if (!tableData.rows[rowIndex]) {
            tableData.rows[rowIndex] = [];
          }
          
          tableData.rows[rowIndex][colIndex] = getBlockText(cell, blockMap);
        }
      });
      
      if (tableData.rows.length > 0) {
        tables.push(tableData);
      }
    });

    return {
      keyValuePairs,
      tables,
      documentText: blocks
        .filter(b => b.BlockType === 'LINE')
        .map(b => b.Text)
        .join('\n')
        .substring(0, 5000), // Limit text for cost control
    };

  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
}

/**
 * Get text from a block
 */
function getBlockText(block: any, blockMap: Map<string, any>): string {
  if (!block) return '';
  
  if (block.Text) return block.Text;
  
  const childIds = block.Relationships?.find((r: any) => r.Type === 'CHILD')?.Ids || [];
  return childIds
    .map((id: string) => blockMap.get(id)?.Text || '')
    .filter((t: string) => t)
    .join(' ');
}

/**
 * Generate extraction rules using Bedrock AI
 */
async function generateRulesWithBedrock(
  schema: any,
  documentAnalyses: any[],
  documentTypeName: string
): Promise<{
  rules: ExtractionRule[];
  overallConfidence: number;
  usage: { inputTokens: number; outputTokens: number; cost: number };
}> {
  
  // Build efficient prompt
  const prompt = buildPrompt(schema, documentAnalyses, documentTypeName);

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: MAX_TOKENS,
    temperature: 0.3, // Lower temperature for more consistent results
    messages: [
      {
        role: 'user',
        content: prompt,
      }
    ],
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Extract usage metrics
  const inputTokens = responseBody.usage?.input_tokens || 0;
  const outputTokens = responseBody.usage?.output_tokens || 0;
  const cost = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN);

  console.log(`Bedrock usage: ${inputTokens} input + ${outputTokens} output tokens = $${cost.toFixed(4)}`);

  // Parse AI response
  const aiResponse = responseBody.content[0].text;
  const rules = parseAIResponse(aiResponse, schema);

  return {
    rules,
    overallConfidence: calculateOverallConfidence(rules),
    usage: { inputTokens, outputTokens, cost },
  };
}

/**
 * Build efficient prompt for Bedrock
 */
function buildPrompt(schema: any, analyses: any[], documentTypeName: string): string {
  // Summarize analyses to reduce token count
  const summaries = analyses.map((analysis, idx) => {
    const kvSummary = analysis.keyValuePairs
      .slice(0, 20) // Limit to top 20 for cost control
      .map((kv: any) => `"${kv.key}": "${kv.value}"`)
      .join(', ');
    
    const tableSummary = analysis.tables.length > 0 
      ? `Found ${analysis.tables.length} table(s) with columns: ${analysis.tables[0].rows[0]?.join(', ') || 'unknown'}`
      : 'No tables';
    
    return `Document ${idx + 1}:\n- Key-Values: ${kvSummary}\n- Tables: ${tableSummary}`;
  }).join('\n\n');

  const fieldsList = schema.fields
    .map((f: any) => `- ${f.fieldId} (${f.name}): ${f.dataType}${f.required ? ' [REQUIRED]' : ''}${f.description ? ` - ${f.description}` : ''}`)
    .join('\n');

  return `You are an expert at analyzing documents and creating extraction rules. 

DOCUMENT TYPE: ${documentTypeName}

REQUIRED FIELDS TO EXTRACT:
${fieldsList}

SAMPLE DOCUMENT ANALYSES:
${summaries}

TASK: Generate extraction rules for each required field. For each field, determine the best extraction method:

1. "textract_kv" - For key-value pairs (e.g., "Invoice Number: 12345")
   - Provide keyPattern (the label text, use | for alternatives)
   - Provide confidence threshold (0.7-0.9)

2. "regex" - For pattern-based extraction (e.g., dates, IDs)
   - Provide regex pattern
   - Provide capture group (usually 0)

3. "table" - For tabular data
   - Provide tableIndex (0 for first table)
   - Provide columnMapping (map column headers to field names)

RESPOND WITH VALID JSON ONLY (no markdown, no explanation):
{
  "rules": [
    {
      "fieldId": "field_name",
      "method": "textract_kv|regex|table",
      "params": { /* method-specific params */ },
      "confidence": 0.85,
      "reasoning": "brief explanation"
    }
  ]
}

Be concise. Focus on accuracy. Use the most reliable method for each field based on the sample documents.`;
}

/**
 * Parse AI response into extraction rules
 */
function parseAIResponse(aiResponse: string, schema: any): ExtractionRule[] {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = aiResponse.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    const rules: ExtractionRule[] = [];

    parsed.rules?.forEach((rule: any, idx: number) => {
      // Validate field exists in schema
      const field = schema.fields.find((f: any) => f.fieldId === rule.fieldId);
      if (!field) {
        console.warn(`AI suggested field ${rule.fieldId} not in schema, skipping`);
        return;
      }

      rules.push({
        ruleId: `rule-${idx}`,
        fieldId: rule.fieldId,
        method: rule.method,
        params: rule.params || {},
        confidence: rule.confidence,
        reasoning: rule.reasoning,
      });
    });

    return rules;

  } catch (error) {
    console.error('Error parsing AI response:', error);
    console.error('AI Response:', aiResponse);
    throw new Error('Failed to parse AI-generated rules');
  }
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(rules: ExtractionRule[]): number {
  if (rules.length === 0) return 0;
  const sum = rules.reduce((acc, rule) => acc + (rule.confidence || 0.5), 0);
  return sum / rules.length;
}

/**
 * Get content type from filename
 */
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'tiff':
    case 'tif':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
}
