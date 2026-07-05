/**
 * Direct Textract Test
 * Tests AWS Textract directly with the uploaded PDF
 */

import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';

const REGION = 'us-east-1';
const BUCKET = 'document-platform-380018306486-us-east-1';
const KEY = 'test-fixed.pdf';

async function testTextract() {
  console.log('🧪 Testing Textract Directly');
  console.log('='.repeat(60));
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Key: ${KEY}`);
  console.log('');

  const client = new TextractClient({ region: REGION });

  try {
    console.log('📤 Calling Textract DetectDocumentText (simpler API)...');
    const { DetectDocumentTextCommand } = await import('@aws-sdk/client-textract');
    const simpleCommand = new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: BUCKET,
          Name: KEY,
        },
      },
    });

    const simpleResponse = await client.send(simpleCommand);
    console.log('✓ DetectDocumentText successful!');
    console.log(`  Blocks returned: ${simpleResponse.Blocks?.length || 0}`);
    
    const textBlocks = simpleResponse.Blocks?.filter(b => b.BlockType === 'LINE') || [];
    console.log(`📄 Extracted ${textBlocks.length} text lines:`);
    console.log('-'.repeat(60));
    
    textBlocks.slice(0, 20).forEach((block, idx) => {
      console.log(`${idx + 1}. ${block.Text}`);
    });

    if (textBlocks.length > 20) {
      console.log(`... and ${textBlocks.length - 20} more lines`);
    }
    
    return;
  } catch (simpleError: any) {
    console.error('❌ DetectDocumentText also failed:', simpleError.message);
  }

  try {
    console.log('');
    console.log('📤 Trying Textract AnalyzeDocument...');
    const command = new AnalyzeDocumentCommand({
      Document: {
        S3Object: {
          Bucket: BUCKET,
          Name: KEY,
        },
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    });

    const response = await client.send(command);

    console.log('✓ Textract call successful!');
    console.log(`  Blocks returned: ${response.Blocks?.length || 0}`);
    console.log('');

    // Extract and display text
    const textBlocks = response.Blocks?.filter(b => b.BlockType === 'LINE') || [];
    console.log(`📄 Extracted ${textBlocks.length} text lines:`);
    console.log('-'.repeat(60));
    
    textBlocks.slice(0, 20).forEach((block, idx) => {
      console.log(`${idx + 1}. ${block.Text}`);
    });

    if (textBlocks.length > 20) {
      console.log(`... and ${textBlocks.length - 20} more lines`);
    }

  } catch (error: any) {
    console.error('❌ Textract call failed:');
    console.error(`  Error name: ${error.name}`);
    console.error(`  Error message: ${error.message}`);
    console.error(`  Error code: ${error.Code || error.$metadata?.httpStatusCode}`);
    console.error('');
    console.error('Full error:', JSON.stringify(error, null, 2));
    process.exit(1);
  }
}

testTextract();
