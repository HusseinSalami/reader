/**
 * Direct Test: Document Extraction with Real Files
 * 
 * This script tests document processing directly without going through the API.
 * It uploads files to S3 and tests Textract extraction.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DocumentProcessor } from './lambdas/layers/shared/nodejs/document-processor';
import * as fs from 'fs';
import * as path from 'path';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.BUCKET_NAME || 'documentplatformstack-documentbucket4ec6b84d-iqxqxqxqxqxq';
const CUSTOMER_ID = 'test-customer-direct';

async function main() {
  console.log('🧪 Testing Document Extraction with Real Files');
  console.log('='.repeat(60));
  console.log(`Region: ${REGION}`);
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log('');

  const s3Client = new S3Client({ region: REGION });
  const documentProcessor = new DocumentProcessor();

  // Step 1: Upload questionnaire
  console.log('📤 Step 1: Uploading questionnaire...');
  const questionnaireFile = path.join(__dirname, 'examples', 'Grade 11 -Mid year exam Jan.2026-questions-fixed.pdf');
  
  if (!fs.existsSync(questionnaireFile)) {
    console.error(`❌ File not found: ${questionnaireFile}`);
    process.exit(1);
  }

  const questionnaireContent = fs.readFileSync(questionnaireFile);
  const questionnaireKey = `test-exams/${CUSTOMER_ID}/questionnaire-${Date.now()}.pdf`;
  
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: questionnaireKey,
    Body: questionnaireContent,
    ContentType: 'application/pdf',
  }));

  const questionnaireUrl = `s3://${BUCKET_NAME}/${questionnaireKey}`;
  console.log(`✓ Uploaded: ${questionnaireUrl}`);
  console.log('');

  // Step 2: Extract questions
  console.log('🔍 Step 2: Extracting questions from questionnaire...');
  try {
    const extracted = await documentProcessor.extractQuestionsFromQuestionnaire(
      questionnaireUrl,
      CUSTOMER_ID
    );

    console.log(`✓ Extraction successful!`);
    console.log(`  Total questions: ${extracted.totalQuestions}`);
    console.log(`  Sections: ${extracted.sections.length}`);
    console.log(`  Confidence: ${extracted.extractionConfidence}%`);
    console.log('');

    // Display extracted questions
    console.log('📋 Extracted Questions:');
    console.log('-'.repeat(60));
    extracted.sections.forEach((section, idx) => {
      console.log(`\nSection ${idx + 1}: ${section.sectionTitle}`);
      section.questions.forEach((q) => {
        const preview = q.questionText.length > 80 
          ? q.questionText.substring(0, 80) + '...'
          : q.questionText;
        console.log(`  Q${q.questionNumber}: ${preview}`);
        if (q.points) {
          console.log(`    Points: ${q.points}`);
        }
      });
    });
    console.log('');

  } catch (error) {
    console.error('❌ Question extraction failed:');
    console.error(error);
    process.exit(1);
  }

  // Step 3: Upload answer key
  console.log('📤 Step 3: Uploading answer key...');
  const answerKeyFile = path.join(__dirname, 'examples', 'Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers-fixed.pdf');
  
  if (!fs.existsSync(answerKeyFile)) {
    console.error(`❌ File not found: ${answerKeyFile}`);
    process.exit(1);
  }

  const answerKeyContent = fs.readFileSync(answerKeyFile);
  const answerKeyKey = `test-exams/${CUSTOMER_ID}/answer-key-${Date.now()}.pdf`;
  
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: answerKeyKey,
    Body: answerKeyContent,
    ContentType: 'application/pdf',
  }));

  const answerKeyUrl = `s3://${BUCKET_NAME}/${answerKeyKey}`;
  console.log(`✓ Uploaded: ${answerKeyUrl}`);
  console.log('');

  // Step 4: Extract answer key
  console.log('🔍 Step 4: Extracting answer key mappings...');
  try {
    const mappings = await documentProcessor.extractAnswerKeyMappings(
      answerKeyUrl,
      CUSTOMER_ID
    );

    console.log(`✓ Extraction successful!`);
    console.log(`  Total answers: ${mappings.length}`);
    console.log('');

    // Display extracted answers
    console.log('📋 Extracted Answer Key:');
    console.log('-'.repeat(60));
    mappings.slice(0, 10).forEach((mapping) => {
      const preview = mapping.expectedAnswer.length > 80 
        ? mapping.expectedAnswer.substring(0, 80) + '...'
        : mapping.expectedAnswer;
      console.log(`Q${mapping.questionNumber}: ${preview}`);
    });
    
    if (mappings.length > 10) {
      console.log(`... and ${mappings.length - 10} more answers`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Answer key extraction failed:');
    console.error(error);
    process.exit(1);
  }

  console.log('✅ All tests passed!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Try creating an exam through the UI');
  console.log('  2. Upload student submissions');
  console.log('  3. Test AI grading');
}

main().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
