// Check Textract Status Lambda
// Polls Textract job status and retrieves results when complete

import { 
  TextractClient, 
  GetDocumentAnalysisCommand,
  DocumentMetadata,
  Block
} from '@aws-sdk/client-textract';

const textract = new TextractClient({});

interface CheckStatusEvent {
  documentId: string;
  customerId: string;
  textractJobId: string;
  s3Bucket: string;
  s3Key: string;
}

export const handler = async (event: CheckStatusEvent) => {
  console.log('Checking Textract status:', event.textractJobId);

  try {
    const command = new GetDocumentAnalysisCommand({
      JobId: event.textractJobId,
    });

    const response = await textract.send(command);
    const status = response.JobStatus;

    console.log('Textract job status:', status);

    if (status === 'SUCCEEDED') {
      // Parse Textract output
      const textractOutput = parseTextractResponse(response.Blocks || []);

      return {
        ...event,
        textractStatus: 'SUCCEEDED',
        textractOutput,
      };
    } else if (status === 'FAILED') {
      return {
        ...event,
        textractStatus: 'FAILED',
        error: response.StatusMessage || 'Textract job failed',
      };
    } else {
      // Still in progress
      return {
        ...event,
        textractStatus: 'IN_PROGRESS',
      };
    }
  } catch (error: any) {
    console.error('Error checking Textract status:', error);
    throw new Error(`Failed to check Textract status: ${error.message}`);
  }
};

function parseTextractResponse(blocks: Block[]) {
  const output: any = {
    text: '',
    keyValuePairs: [],
    tables: [],
  };

  // Extract full text
  const textBlocks = blocks.filter(b => b.BlockType === 'LINE');
  output.text = textBlocks.map(b => b.Text).join('\n');

  // Extract key-value pairs
  const kvBlocks = blocks.filter(b => b.BlockType === 'KEY_VALUE_SET');
  for (const kvBlock of kvBlocks) {
    if (kvBlock.EntityTypes?.includes('KEY')) {
      const key = extractText(kvBlock, blocks);
      const valueBlock = findValueBlock(kvBlock, blocks);
      const value = valueBlock ? extractText(valueBlock, blocks) : '';
      
      output.keyValuePairs.push({
        key,
        value,
        confidence: kvBlock.Confidence || 0,
      });
    }
  }

  // Extract tables
  const tableBlocks = blocks.filter(b => b.BlockType === 'TABLE');
  for (const tableBlock of tableBlocks) {
    const table = extractTable(tableBlock, blocks);
    output.tables.push(table);
  }

  return output;
}

function extractText(block: Block, allBlocks: Block[]): string {
  if (!block.Relationships) return block.Text || '';
  
  const childIds = block.Relationships
    .filter(r => r.Type === 'CHILD')
    .flatMap(r => r.Ids || []);
  
  const children = allBlocks.filter(b => childIds.includes(b.Id || ''));
  return children.map(c => c.Text).join(' ');
}

function findValueBlock(keyBlock: Block, allBlocks: Block[]): Block | null {
  if (!keyBlock.Relationships) return null;
  
  const valueIds = keyBlock.Relationships
    .filter(r => r.Type === 'VALUE')
    .flatMap(r => r.Ids || []);
  
  return allBlocks.find(b => valueIds.includes(b.Id || '')) || null;
}

function extractTable(tableBlock: Block, allBlocks: Block[]): any {
  const cells: any[] = [];
  
  if (tableBlock.Relationships) {
    const cellIds = tableBlock.Relationships
      .filter(r => r.Type === 'CHILD')
      .flatMap(r => r.Ids || []);
    
    for (const cellId of cellIds) {
      const cellBlock = allBlocks.find(b => b.Id === cellId);
      if (cellBlock && cellBlock.BlockType === 'CELL') {
        cells.push({
          rowIndex: cellBlock.RowIndex || 0,
          columnIndex: cellBlock.ColumnIndex || 0,
          text: extractText(cellBlock, allBlocks),
          confidence: cellBlock.Confidence || 0,
        });
      }
    }
  }

  // Organize cells into rows
  const rows: any[] = [];
  const maxRow = Math.max(...cells.map(c => c.rowIndex));
  
  for (let i = 1; i <= maxRow; i++) {
    const rowCells = cells.filter(c => c.rowIndex === i);
    rowCells.sort((a, b) => a.columnIndex - b.columnIndex);
    rows.push({ cells: rowCells });
  }

  return {
    rows,
    confidence: tableBlock.Confidence || 0,
  };
}
