// Extract Fields Lambda
// Applies template extraction rules to Textract output

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || 'DocumentPlatform';

interface ExtractFieldsEvent {
  documentId: string;
  customerId: string;
  documentTypeId: string;
  templateId: string;
  textractOutput: any;
}

export const handler = async (event: ExtractFieldsEvent) => {
  console.log('Extracting fields:', event.documentId);

  try {
    // Load template
    const template = await loadTemplate(event.customerId, event.templateId);
    if (!template) {
      throw new Error(`Template ${event.templateId} not found`);
    }

    // Load document type schema
    const documentType = await loadDocumentType(event.customerId, event.documentTypeId);
    if (!documentType) {
      throw new Error(`Document type ${event.documentTypeId} not found`);
    }

    // Extract fields using template rules
    const extractedData: any = {
      fields: {},
    };

    for (const rule of template.rules) {
      const field = documentType.schema.fields.find((f: any) => f.fieldId === rule.fieldId);
      if (!field) continue;

      const value = applyExtractionRule(rule, event.textractOutput);
      
      extractedData.fields[rule.fieldId] = {
        fieldId: rule.fieldId,
        value,
        confidence: value?.confidence || 0,
        source: 'textract',
        corrected: false,
      };
    }

    return {
      ...event,
      template,
      documentType,
      extractedData,
    };
  } catch (error: any) {
    console.error('Field extraction failed:', error);
    throw new Error(`Field extraction failed: ${error.message}`);
  }
};

async function loadTemplate(customerId: string, templateId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `CUSTOMER#${customerId}`,
      SK: `TEMPLATE#${templateId}`,
    },
  }));
  return result.Item;
}

async function loadDocumentType(customerId: string, documentTypeId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `CUSTOMER#${customerId}`,
      SK: `DOCTYPE#${documentTypeId}`,
    },
  }));
  return result.Item;
}

function applyExtractionRule(rule: any, textractOutput: any): any {
  switch (rule.method) {
    case 'textract_kv':
      return extractFromKeyValue(rule.params, textractOutput);
    case 'regex':
      return extractFromRegex(rule.params, textractOutput);
    case 'table':
      return extractFromTable(rule.params, textractOutput);
    default:
      return null;
  }
}

function extractFromKeyValue(params: any, textractOutput: any): any {
  const { keyPattern, confidence: minConfidence = 0 } = params;
  
  for (const kv of textractOutput.keyValuePairs) {
    if (kv.key.toLowerCase().includes(keyPattern.toLowerCase())) {
      if (kv.confidence >= minConfidence) {
        return {
          value: kv.value,
          confidence: kv.confidence,
        };
      }
    }
  }
  
  return null;
}

function extractFromRegex(params: any, textractOutput: any): any {
  const { pattern, captureGroup = 0, flags = '' } = params;
  const regex = new RegExp(pattern, flags);
  const match = textractOutput.text.match(regex);
  
  if (match) {
    return {
      value: match[captureGroup] || match[0],
      confidence: 1.0,
    };
  }
  
  return null;
}

function extractFromTable(params: any, textractOutput: any): any {
  const { tableIndex, columnMapping } = params;
  
  if (tableIndex >= textractOutput.tables.length) {
    return null;
  }
  
  const table = textractOutput.tables[tableIndex];
  const extractedRows: any[] = [];
  
  // Assume first row is header
  const headerRow = table.rows[0];
  const headers = headerRow.cells.map((c: any) => c.text);
  
  // Extract data rows
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    const rowData: any = {};
    
    for (const [columnName, fieldName] of Object.entries(columnMapping)) {
      const columnIndex = headers.indexOf(columnName);
      if (columnIndex >= 0 && columnIndex < row.cells.length) {
        rowData[fieldName as string] = row.cells[columnIndex].text;
      }
    }
    
    extractedRows.push(rowData);
  }
  
  return {
    value: extractedRows,
    confidence: table.confidence,
  };
}
