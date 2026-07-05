/**
 * Diagnose Answer Images
 * 
 * Tests Textract extraction on the answer images to see what's being detected
 */

import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.BUCKET_NAME || 'document-platform-380018306486-us-east-1';
const EXAMPLES_DIR = path.join(__dirname, 'examples');

async function diagnoseImages() {
  console.log('🔍 Diagnosing Answer Images');
  console.log('='.repeat(60));
  console.log(`Region: ${REGION}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log('');

  const textractClient = new TextractClient({ region: REGION });
  const s3Client = new S3Client({ region: REGION });

  // Test with first answer image
  const testFile = 'answer1.jpeg';
  const filePath = path.join(EXAMPLES_DIR, testFile);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Testing file: ${testFile}`);
  console.log('');

  try {
    // Upload to S3 first
    const fileContent = fs.readFileSync(filePath);
    const s3Key = `test-diagnosis/${testFile}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'image/jpeg',
    }));

    console.log(`✓ Uploaded to S3: s3://${BUCKET}/${s3Key}`);
    console.log('');

    // Run Textract
    console.log('Running Textract analysis...');
    const response = await textractClient.send(new AnalyzeDocumentCommand({
      Document: {
        S3Object: {
          Bucket: BUCKET,
          Name: s3Key,
        },
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    }));

    console.log('');
    console.log('='.repeat(60));
    console.log('TEXTRACT RESULTS');
    console.log('='.repeat(60));
    console.log('');

    if (!response.Blocks || response.Blocks.length === 0) {
      console.log('❌ No blocks returned from Textract');
      return;
    }

    console.log(`Total blocks: ${response.Blocks.length}`);
    console.log('');

    // Count block types
    const blockTypes: Record<string, number> = {};
    for (const block of response.Blocks) {
      blockTypes[block.BlockType || 'UNKNOWN'] = (blockTypes[block.BlockType || 'UNKNOWN'] || 0) + 1;
    }

    console.log('Block types:');
    for (const [type, count] of Object.entries(blockTypes)) {
      console.log(`  ${type}: ${count}`);
    }
    console.log('');

    // Extract LINE blocks (the actual text)
    const lineBlocks = response.Blocks.filter(b => b.BlockType === 'LINE');
    console.log(`LINE blocks (text lines): ${lineBlocks.length}`);
    console.log('');

    if (lineBlocks.length > 0) {
      console.log('First 10 text lines extracted:');
      console.log('-'.repeat(60));
      lineBlocks.slice(0, 10).forEach((block, idx) => {
        console.log(`${idx + 1}. "${block.Text}" (confidence: ${block.Confidence?.toFixed(1)}%)`);
      });
      console.log('');

      // Check for question markers
      console.log('Checking for question number markers...');
      const questionPatterns = [
        /^(\d+)[.)]\s*/,
        /^[Qq](\d+)[.)]\s*/,
        /^\((\d+)\)\s*/,
      ];

      let foundMarkers = 0;
      for (const block of lineBlocks) {
        for (const pattern of questionPatterns) {
          const match = block.Text?.match(pattern);
          if (match) {
            console.log(`  ✓ Found Q${match[1]}: "${block.Text}"`);
            foundMarkers++;
            break;
          }
        }
      }

      if (foundMarkers === 0) {
        console.log('  ⚠ No question number markers found!');
        console.log('  This means the handwriting recognizer cannot map text to questions.');
        console.log('');
        console.log('  Possible solutions:');
        console.log('  1. Ensure answer sheets have clear question numbers (1., 2., Q1, etc.)');
        console.log('  2. Use a different mapping strategy (e.g., sequential assignment)');
        console.log('  3. Pre-process images to add question markers');
      } else {
        console.log(`  ✓ Found ${foundMarkers} question markers`);
      }
    } else {
      console.log('❌ No text lines extracted from the image!');
      console.log('   The image may not contain readable text or handwriting.');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('DIAGNOSIS COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    process.exit(1);
  }
}

diagnoseImages();
