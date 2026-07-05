/**
 * Test Real Exam Workflow
 * 
 * Tests the complete exam grading workflow using the actual exam documents:
 * 1. Extract questions from the exam PDF
 * 2. Extract answer key from the answer key PDF
 * 3. Create exam in DynamoDB
 * 4. Process student answer images
 * 5. Grade submissions using AI
 */

import { DocumentProcessor } from './lambdas/layers/shared/nodejs/document-processor';
import { HandwritingRecognizer } from './lambdas/layers/shared/nodejs/handwriting-recognizer';
import { AIGradingEngine } from './lambdas/layers/shared/nodejs/ai-grading-engine';
import { ExamManagementService } from './lambdas/layers/shared/nodejs/exam-management-service';
import { SubmissionManagementService } from './lambdas/layers/shared/nodejs/submission-management-service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import type { QuestionContext } from './lambdas/layers/shared/nodejs/exam-types';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.BUCKET_NAME || 'document-platform-380018306486-us-east-1';
const CUSTOMER_ID = 'test-customer-real-exam';
const TEACHER_ID = 'teacher-real-exam';
const EXAMPLES_DIR = path.join(__dirname, 'examples');

async function testRealExamWorkflow() {
  console.log('🎓 Testing Real Exam Workflow');
  console.log('='.repeat(80));
  console.log(`Region: ${REGION}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Examples: ${EXAMPLES_DIR}`);
  console.log('');

  const s3Client = new S3Client({ region: REGION });
  const documentProcessor = new DocumentProcessor();
  const handwritingRecognizer = new HandwritingRecognizer();
  const gradingEngine = new AIGradingEngine();
  const examService = new ExamManagementService();
  const submissionService = new SubmissionManagementService();

  try {
    // ========================================
    // STEP 1: Upload and Extract Questionnaire
    // ========================================
    console.log('📄 STEP 1: Processing Exam Questionnaire');
    console.log('-'.repeat(80));

    const questionnaireFile = 'Grade 11 -Mid year exam Jan.2026-questions.docx';
    const questionnairePath = path.join(EXAMPLES_DIR, questionnaireFile);

    if (!fs.existsSync(questionnairePath)) {
      throw new Error(`Questionnaire file not found: ${questionnairePath}`);
    }

    // Upload to S3
    const questionnaireS3Key = `real-exam-test/${CUSTOMER_ID}/${questionnaireFile}`;
    const questionnaireContent = fs.readFileSync(questionnairePath);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: questionnaireS3Key,
      Body: questionnaireContent,
      ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }));

    const questionnaireUrl = `s3://${BUCKET}/${questionnaireS3Key}`;
    console.log(`✓ Uploaded questionnaire: ${questionnaireUrl}`);

    // Extract questions
    console.log('Extracting questions from PDF...');
    const questionnaire = await documentProcessor.extractQuestionsFromQuestionnaire(
      questionnaireUrl,
      CUSTOMER_ID
    );

    console.log(`✓ Extracted ${questionnaire.totalQuestions} questions`);
    console.log(`  Sections: ${questionnaire.sections.length}`);
    console.log(`  Confidence: ${questionnaire.extractionConfidence}%`);
    
    // Show first 3 questions
    console.log('\nFirst 3 questions:');
    let questionCount = 0;
    for (const section of questionnaire.sections) {
      for (const question of section.questions) {
        if (questionCount < 3) {
          console.log(`  Q${question.questionNumber} (${question.points}pts): ${question.questionText.substring(0, 80)}...`);
          questionCount++;
        }
      }
    }
    console.log('');

    // ========================================
    // STEP 2: Upload and Extract Answer Key
    // ========================================
    console.log('📝 STEP 2: Processing Answer Key');
    console.log('-'.repeat(80));

    const answerKeyFile = 'Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers.docx';
    const answerKeyPath = path.join(EXAMPLES_DIR, answerKeyFile);

    if (!fs.existsSync(answerKeyPath)) {
      throw new Error(`Answer key file not found: ${answerKeyPath}`);
    }

    // Upload to S3
    const answerKeyS3Key = `real-exam-test/${CUSTOMER_ID}/${answerKeyFile}`;
    const answerKeyContent = fs.readFileSync(answerKeyPath);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: answerKeyS3Key,
      Body: answerKeyContent,
      ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }));

    const answerKeyUrl = `s3://${BUCKET}/${answerKeyS3Key}`;
    console.log(`✓ Uploaded answer key: ${answerKeyUrl}`);

    // Extract answer key
    console.log('Extracting answer key from PDF...');
    const answerMappings = await documentProcessor.extractAnswerKeyMappings(
      answerKeyUrl,
      CUSTOMER_ID
    );

    console.log(`✓ Extracted ${answerMappings.length} answer mappings`);
    
    // Show first 2 answer mappings
    console.log('\nFirst 2 answer mappings:');
    answerMappings.slice(0, 2).forEach(mapping => {
      console.log(`  Q${mapping.questionNumber}:`);
      console.log(`    Expected: ${mapping.expectedAnswer.substring(0, 100)}...`);
      console.log(`    Keywords: ${mapping.keywords.slice(0, 5).join(', ')}`);
    });
    console.log('');

    // ========================================
    // STEP 3: Create Exam Manually
    // ========================================
    console.log('💾 STEP 3: Creating Exam in DynamoDB');
    console.log('-'.repeat(80));

    // We'll create the exam manually since we have the extracted data
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const { randomUUID } = await import('crypto');

    const dynamoClient = new DynamoDBClient({ region: REGION });
    const docClient = DynamoDBDocumentClient.from(dynamoClient);

    const examId = `exam-${randomUUID()}`;
    const timestamp = new Date().toISOString();
    const EXAMS_TABLE = process.env.EXAMS_TABLE_NAME || 'DocumentPlatform-Exams';

    const examRecord = {
      PK: `CUSTOMER#${CUSTOMER_ID}`,
      SK: `EXAM#${examId}`,
      examId,
      customerId: CUSTOMER_ID,
      teacherId: TEACHER_ID,
      title: 'Grade 11 Mid-Year Exam - January 2026 (Real Test)',
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'ACTIVE',
      questionnaireS3Key: questionnaireUrl,
      sections: questionnaire.sections,
      totalQuestions: questionnaire.totalQuestions,
      totalPoints: questionnaire.sections.reduce((sum, section) => 
        sum + section.questions.reduce((qSum, q) => qSum + q.points, 0), 0
      ),
      answerKeyS3Key: answerKeyUrl,
      answerMappings: answerMappings,
      submissionCount: 0,
      totalCost: 0,
      GSI1PK: `TEACHER#${TEACHER_ID}`,
      GSI1SK: `EXAM#${timestamp}`,
    };

    await docClient.send(new PutCommand({
      TableName: EXAMS_TABLE,
      Item: examRecord,
    }));

    // Create exam object for use in the rest of the test
    const exam = {
      examId,
      customerId: CUSTOMER_ID,
      teacherId: TEACHER_ID,
      title: examRecord.title,
      createdAt: timestamp,
      updatedAt: timestamp,
      questionnaire,
      answerKey: answerMappings,
      status: 'ACTIVE' as const,
      submissionCount: 0,
      totalCost: 0,
    };

    console.log(`✓ Exam created: ${exam.examId}`);
    console.log(`  Title: ${exam.title}`);
    console.log(`  Questions: ${exam.questionnaire.totalQuestions}`);
    console.log(`  Sections: ${exam.questionnaire.sections.length}`);
    console.log('');

    // ========================================
    // STEP 4: Process Student Submissions
    // ========================================
    console.log('📸 STEP 4: Processing Student Answer Sheets');
    console.log('-'.repeat(80));

    const answerFiles = [
      'answer1.jpeg',
      'answer2.jpeg',
      'answer3.jpeg',
      'answer4.jpeg',
      'answer5.jpeg',
    ];

    const studentNames = [
      'Fatima Ali',
      'Ahmed Hassan',
      'Sara Mohammed',
      'Omar Ibrahim',
      'Layla Khalil',
    ];

    const submissions = [];

    for (let i = 0; i < answerFiles.length; i++) {
      const answerFile = answerFiles[i];
      const studentName = studentNames[i];
      const answerPath = path.join(EXAMPLES_DIR, answerFile);

      if (!fs.existsSync(answerPath)) {
        console.warn(`⚠ Answer file not found: ${answerFile}, skipping...`);
        continue;
      }

      console.log(`\nProcessing ${studentName} (${answerFile})...`);

      // Upload to S3
      const answerS3Key = `real-exam-test/${CUSTOMER_ID}/submissions/${answerFile}`;
      const answerContent = fs.readFileSync(answerPath);
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: answerS3Key,
        Body: answerContent,
        ContentType: 'image/jpeg',
      }));

      const answerUrl = `s3://${BUCKET}/${answerS3Key}`;
      console.log(`  ✓ Uploaded to S3`);

      // Extract handwritten answers
      console.log(`  Extracting handwritten text...`);
      const extracted = await handwritingRecognizer.extractHandwrittenAnswers(
        answerUrl,
        exam.questionnaire,
        CUSTOMER_ID
      );

      console.log(`  ✓ Extracted ${extracted.answers.length} answers`);
      console.log(`    Overall confidence: ${extracted.overallConfidence}%`);
      if (extracted.flaggedForReview && extracted.flaggedForReview.length > 0) {
        console.log(`    ⚠ Flagged for review: Q${extracted.flaggedForReview.join(', Q')}`);
      }

      // Create submission
      const submission = await submissionService.createSubmission({
        examId: exam.examId,
        studentId: `student-${i + 1}`,
        studentName,
        documentUrl: answerUrl,
      }, CUSTOMER_ID);

      console.log(`  ✓ Created submission: ${submission.submissionId}`);

      submissions.push({
        submission,
        extracted,
      });
    }

    console.log('');
    console.log(`✓ Processed ${submissions.length} student submissions`);
    console.log('');

    // ========================================
    // STEP 5: Grade First Submission
    // ========================================
    console.log('🤖 STEP 5: AI Grading (First Submission)');
    console.log('-'.repeat(80));

    if (submissions.length === 0) {
      console.log('⚠ No submissions to grade');
      return;
    }

    const firstSubmission = submissions[0];
    console.log(`Grading ${studentNames[0]}'s submission...`);
    console.log('');

    let totalScore = 0;
    let maxScore = 0;

    // Grade first 3 questions
    for (let i = 0; i < Math.min(3, firstSubmission.extracted.answers.length); i++) {
      const extractedAnswer = firstSubmission.extracted.answers[i];
      const expectedAnswer = exam.answerKey.find(
        ak => ak.questionNumber === extractedAnswer.questionNumber
      );

      if (!expectedAnswer) {
        console.log(`⚠ No expected answer for Q${extractedAnswer.questionNumber}`);
        continue;
      }

      const question = exam.questionnaire.sections
        .flatMap(s => s.questions)
        .find(q => q.questionNumber === extractedAnswer.questionNumber);

      if (!question) {
        console.log(`⚠ No question found for Q${extractedAnswer.questionNumber}`);
        continue;
      }

      console.log(`Question ${extractedAnswer.questionNumber}: ${question.questionText.substring(0, 60)}...`);
      console.log(`  Student answer: ${extractedAnswer.extractedText.substring(0, 100)}...`);
      console.log(`  Extraction confidence: ${extractedAnswer.confidence}%`);

      const questionContext: QuestionContext = {
        questionNumber: question.questionNumber,
        questionText: question.questionText,
        maxPoints: question.points,
        keywords: expectedAnswer.keywords,
      };

      const gradingResult = await gradingEngine.gradeAnswer(
        extractedAnswer.extractedText,
        expectedAnswer.expectedAnswer,
        questionContext,
        CUSTOMER_ID
      );

      console.log(`  ✓ Grade: ${gradingResult.marksAwarded}/${question.points} points`);
      console.log(`    AI Confidence: ${gradingResult.confidence}%`);
      console.log(`    Explanation: ${gradingResult.explanation.substring(0, 150)}...`);
      console.log('');

      totalScore += gradingResult.marksAwarded;
      maxScore += question.points;
    }

    console.log('='.repeat(80));
    console.log(`📊 GRADING SUMMARY`);
    console.log(`Student: ${studentNames[0]}`);
    console.log(`Score: ${totalScore}/${maxScore} (${((totalScore/maxScore)*100).toFixed(1)}%)`);
    console.log('='.repeat(80));
    console.log('');

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(80));
    console.log(`Exam ID: ${exam.examId}`);
    console.log(`Total Questions: ${exam.questionnaire.totalQuestions}`);
    console.log(`Submissions Processed: ${submissions.length}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Review the grading results above');
    console.log('  2. Check if AI grading matches expected answers');
    console.log('  3. Verify handwriting extraction quality');
    console.log('  4. Test with more submissions if needed');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

testRealExamWorkflow();
