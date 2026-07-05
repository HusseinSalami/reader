/**
 * Direct PDF Test
 * Tests Textract directly on the PDF to see the actual error
 */

import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.BUCKET_NAME || 'document-platform-380018306486-us-east-1';

async function testPdfDirect() {
  console.log('🔍 Direct PDF Textract Test');
  console.log('='.repeat(60));

  const s3Client = new S3Client({ region: REGION });
  const textractClient = new TextractClient({ region: REGION });

  const pdfPath = path.join(__dirname, 'examples', 'Grade 11 -Mid year exam Jan.2026-questions.pdf');
  
  console.log(`Reading PDF: ${pdfPath}`);
  const pdfContent = fs.readFileSync(pdfPath);
  console.log(`PDF size: ${pdfContent.length} bytes`);
  console.log('');

  // Upload to S3
  const s3Key = 'test-pdf-direct/questionnaire.pdf';
  console.log(`Uploading to S3: s3://${BUCKET}/${s3Key}`);
  
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: pdfContent,
    ContentType: 'application/pdf',
  }));
  
  console.log('✓ Uploaded to S3');
  console.log('');

  // Try Textract with different feature configurations
  const configs = [
    { name: 'TABLES + FORMS', features: ['TABLES', 'FORMS'] },
    { name: 'TABLES only', features: ['TABLES'] },
    { name: 'FORMS only', features: ['FORMS'] },
  ];

  for (const config of configs) {
    console.log(`Testing with: ${config.name}`);
    console.log('-'.repeat(60));
    
    try {
      const command = new AnalyzeDocumentCommand({
        Document: {
          S3Object: {
            Bucket: BUCKET,
            Name: s3Key,
          },
        },
        FeatureTypes: config.features as any,
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
      
      // Show first few lines
      const lines = response.Blocks?.filter(b => b.BlockType === 'LINE').slice(0, 5);
      if (lines && lines.length > 0) {
        console.log(`  First lines:`);
        lines.forEach(line => {
          console.log(`    - ${line.Text}`);
        });
      }
      
      console.log('');
      break; // Success, no need to try other configs
      
    } catch (error) {
      console.log(`✗ Failed`);
      if (error instanceof Error) {
        console.log(`  Error: ${error.message}`);
        console.log(`  Name: ${error.name}`);
        
        // Show full error for debugging
        if (error.message.includes('unsupported') || error.message.includes('invalid')) {
          console.log(`  Full error:`, error);
        }
      }
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log('Test complete');
}

testPdfDirect().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
