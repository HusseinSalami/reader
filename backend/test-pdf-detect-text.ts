/**
 * Test PDF with DetectDocumentText
 * Uses simpler Textract API that might work better
 */

import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.BUCKET_NAME || 'document-platform-380018306486-us-east-1';

async function testPdfDetectText() {
  console.log('🔍 PDF DetectDocumentText Test');
  console.log('='.repeat(60));

  const s3Client = new S3Client({ region: REGION });
  const textractClient = new TextractClient({ region: REGION });

  const pdfPath = path.join(__dirname, 'examples', 'Grade 11 -Mid year exam Jan.2026-questions.pdf');
  
  console.log(`Reading PDF: ${pdfPath}`);
  const pdfContent = fs.readFileSync(pdfPath);
  console.log(`PDF size: ${pdfContent.length} bytes`);
  console.log('');

  // Upload to S3
  const s3Key = 'test-pdf-detect/questionnaire.pdf';
  console.log(`Uploading to S3: s3://${BUCKET}/${s3Key}`);
  
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: pdfContent,
    ContentType: 'application/pdf',
  }));
  
  console.log('✓ Uploaded to S3');
  console.log('');

  console.log('Calling DetectDocumentText...');
  console.log('-'.repeat(60));
  
  try {
    const command = new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: BUCKET,
          Name: s3Key,
        },
      },
    });

    const response = await textractClient.send(command);
    
    console.log(`✓ Success!`);
    console.log(`  Blocks: ${response.Blocks?.length || 0}`);
    
    // Count block types
    const blockTypes: Record<string, number> = {};
    response.Blocks?.forEach(block => {
      blockTypes[block.BlockType || 'UNKNOWN'] = (blockTypes[block.BlockType || 'UNKNOWN'] || 0) + 1;
    });
    
    console.log(`  Block types:`, blockTypes);
    console.log('');
    
    // Show first 20 lines
    const lines = response.Blocks?.filter(b => b.BlockType === 'LINE').slice(0, 20);
    if (lines && lines.length > 0) {
      console.log(`First 20 lines extracted:`);
      console.log('');
      lines.forEach((line, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. ${line.Text}`);
      });
    } else {
      console.log('⚠ No lines extracted!');
    }
    
  } catch (error) {
    console.log(`✗ Failed`);
    if (error instanceof Error) {
      console.log(`  Error: ${error.message}`);
      console.log(`  Name: ${error.name}`);
      console.log('');
      console.log('Full error:', error);
    }
  }

  console.log('');
  console.log('='.repeat(60));
}

testPdfDetectText().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
