/**
 * Complete Real Exam Workflow Test
 * 
 * Tests the entire exam workflow using real PDF documents:
 * 1. Extract questions from questionnaire PDF
 * 2. Extract answer key from answer key PDF
 * 3. Process all 5 student answer sheets
 * 4. Grade all submissions with AI
 * 5. Generate comprehensive report
 */

import { DocumentProcessor } from './lambdas/layers/shared/nodejs/document-processor';
import { HandwritingRecognizer } from './lambdas/layers/shared/nodejs/handwriting-recognizer';
import { AIGradingEngine } from './lambdas/layers/shared/nodejs/ai-grading-engine';
import { ExamManagementService } from './lambdas/layers/shared/nodejs/exam-management-service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import type { QuestionContext } from './lambdas/layers/shared/nodejs/exam-types';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.BUCKET_NAME || 'document-platform-380018306486-us-east-1';
const CUSTOMER_ID = 'test-customer-real-exam';
const TEACHER_ID = 'teacher-real-exam';
const EXAMPLES_DIR = path.join(__dirname, 'examples');

// Set environment variables
process.env.AWS_REGION = REGION;
process.env.EXAMS_TABLE_NAME = process.env.EXAMS_TABLE_NAME || 'DocumentPlatform-Exams';
process.env.SUBMISSIONS_TABLE_NAME = process.env.SUBMISSIONS_TABLE_NAME || 'DocumentPlatform-Submissions';
process.env.BUCKET_NAME = BUCKET;

async function testCompleteWorkflow() {
  console.log('🎓 Complete Real Exam Workflow Test');
  console.log('='.repeat(80));
  console.log(`Region: ${REGION}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Customer: ${CUSTOMER_ID}`);
  console.log(`Examples: ${EXAMPLES_DIR}`);
  console.log('');

  const s3Client = new S3Client({ region: REGION });
  const documentProcessor = new DocumentProcessor();
  const handwritingRecognizer = new HandwritingRecognizer();
  const gradingEngine = new AIGradingEngine();
  const examService = new ExamManagementService();

  try {
    // ========================================
    // STEP 1: Upload and Extract Questionnaire
    // ========================================
    console.log('📄 STEP 1: Processing Questionnaire PDF');
    console.log('-'.repeat(80));

    const questionnairePath = path.join(EXAMPLES_DIR, 'Grade 11 -Mid year exam Jan.2026-questions.pdf');
    
    if (!fs.existsSync(questionnairePath)) {
      throw new Error(`Questionnaire PDF not found: ${questionnairePath}`);
    }

    // Upload to S3
    const questionnaireS3Key = `real-exam-test/${CUSTOMER_ID}/questionnaire.pdf`;
    const questionnaireContent = fs.readFileSync(questionnairePath);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: questionnaireS3Key,
      Body: questionnaireContent,
      ContentType: 'application/pdf',
    }));

    const questionnaireUrl = `s3://${BUCKET}/${questionnaireS3Key}`;
    console.log(`✓ Uploaded questionnaire to S3`);

    // Extract questions
    console.log(`Extracting questions from PDF...`);
    const questionnaire = await documentProcessor.extractQuestionsFromQuestionnaire(
      questionnaireUrl,
      CUSTOMER_ID
    );

    console.log(`✓ Extracted ${questionnaire.totalQuestions} questions`);
    console.log(`  Sections: ${questionnaire.sections.length}`);
    console.log(`  Confidence: ${questionnaire.extractionConfidence}%`);
    console.log('');

    // Show extracted questions
    console.log('Extracted Questions:');
    for (const section of questionnaire.sections) {
      console.log(`\n  ${section.sectionTitle}:`);
      for (const question of section.questions) {
        console.log(`    Q${question.questionNumber} (${question.points}pts): ${question.questionText.substring(0, 70)}...`);
      }
    }
    console.log('');

    // ========================================
    // STEP 2: Upload and Extract Answer Key
    // ========================================
    console.log('📋 STEP 2: Processing Answer Key PDF');
    console.log('-'.repeat(80));

    const answerKeyPath = path.join(EXAMPLES_DIR, 'Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers.pdf');
    
    if (!fs.existsSync(answerKeyPath)) {
      throw new Error(`Answer key PDF not found: ${answerKeyPath}`);
    }

    // Upload to S3
    const answerKeyS3Key = `real-exam-test/${CUSTOMER_ID}/answer-key.pdf`;
    const answerKeyContent = fs.readFileSync(answerKeyPath);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: answerKeyS3Key,
      Body: answerKeyContent,
      ContentType: 'application/pdf',
    }));

    const answerKeyUrl = `s3://${BUCKET}/${answerKeyS3Key}`;
    console.log(`✓ Uploaded answer key to S3`);

    // Extract answer key
    console.log(`Extracting answer key from PDF...`);
    const answerKey = await documentProcessor.extractAnswerKeyMappings(
      answerKeyUrl,
      CUSTOMER_ID
    );

    console.log(`✓ Extracted ${answerKey.length} answer mappings`);
    console.log('');

    // Show extracted answers
    console.log('Extracted Answer Key:');
    for (const answer of answerKey) {
      console.log(`  Q${answer.questionNumber}: ${answer.expectedAnswer.substring(0, 80)}...`);
      console.log(`    Keywords: ${answer.keywords.slice(0, 5).join(', ')}${answer.keywords.length > 5 ? '...' : ''}`);
    }
    console.log('');

    // ========================================
    // STEP 3: Create Exam in Database
    // ========================================
    console.log('💾 STEP 3: Creating Exam in Database');
    console.log('-'.repeat(80));

    const exam = await examService.createExam({
      customerId: CUSTOMER_ID,
      teacherId: TEACHER_ID,
      title: 'Grade 11 Mid-Year Exam - January 2026 (Real Documents)',
      description: 'Real exam created from actual PDF documents for comprehensive testing',
      questionnaire,
      answerKey,
      questionnaireS3Key,
      answerKeyS3Key,
    });

    console.log(`✓ Exam created: ${exam.examId}`);
    console.log(`  Title: ${exam.title}`);
    console.log(`  Questions: ${questionnaire.totalQuestions}`);
    console.log(`  Answer mappings: ${answerKey.length}`);
    console.log('');

    // ========================================
    // STEP 4: Process All Answer Sheets
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

    const extractionResults = [];

    for (let i = 0; i < answerFiles.length; i++) {
      const answerFile = answerFiles[i];
      const studentName = studentNames[i];
      const answerPath = path.join(EXAMPLES_DIR, answerFile);

      if (!fs.existsSync(answerPath)) {
        console.warn(`⚠ Answer file not found: ${answerFile}, skipping...`);
        continue;
      }

      console.log(`\n${'-'.repeat(80)}`);
      console.log(`Processing: ${studentName} (${answerFile})`);
      console.log(`${'-'.repeat(80)}`);

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
      console.log(`✓ Uploaded to S3`);

      // Extract handwritten answers
      console.log(`Extracting handwritten text...`);
      const extracted = await handwritingRecognizer.extractHandwrittenAnswers(
        answerUrl,
        questionnaire,
        CUSTOMER_ID
      );

      console.log(`✓ Extracted ${extracted.answers.length} answers`);
      console.log(`  Overall confidence: ${extracted.overallConfidence}%`);
      console.log(`  Student ID detected: ${extracted.studentId || 'N/A'}`);
      
      if (extracted.flaggedForReview && extracted.flaggedForReview.length > 0) {
        console.log(`  ⚠ Flagged for review: Q${extracted.flaggedForReview.join(', Q')}`);
      }

      // Show extracted answers
      console.log('\n  Extracted answers:');
      extracted.answers.forEach(answer => {
        const preview = answer.extractedText.substring(0, 80);
        console.log(`    Q${answer.questionNumber} (${answer.confidence}%): ${preview}${answer.extractedText.length > 80 ? '...' : ''}`);
      });

      extractionResults.push({
        studentName,
        answerFile,
        extracted,
      });
    }

    console.log('');
    console.log(`✓ Processed ${extractionResults.length} answer sheets`);
    console.log('');

    // ========================================
    // STEP 5: Grade All Submissions
    // ========================================
    console.log('🤖 STEP 5: AI Grading All Submissions');
    console.log('='.repeat(80));

    const gradingResults = [];

    for (const result of extractionResults) {
      console.log(`\n${'-'.repeat(80)}`);
      console.log(`Grading: ${result.studentName}`);
      console.log(`${'-'.repeat(80)}`);

      let totalScore = 0;
      let maxScore = 0;
      const questionGrades = [];

      // Grade all questions
      for (const extractedAnswer of result.extracted.answers) {
        const expectedAnswer = answerKey.find(
          (ak) => ak.questionNumber === extractedAnswer.questionNumber
        );

        if (!expectedAnswer) {
          console.log(`⚠ No expected answer for Q${extractedAnswer.questionNumber}`);
          continue;
        }

        const question = questionnaire.sections
          .flatMap((s) => s.questions)
          .find((q) => q.questionNumber === extractedAnswer.questionNumber);

        if (!question) {
          console.log(`⚠ No question found for Q${extractedAnswer.questionNumber}`);
          continue;
        }

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

        console.log(`  Q${extractedAnswer.questionNumber}: ${gradingResult.marksAwarded}/${question.points} pts (${gradingResult.confidence}% confidence)`);
        if (gradingResult.feedback) {
          console.log(`    Feedback: ${gradingResult.feedback.substring(0, 100)}...`);
        }

        questionGrades.push({
          questionNumber: extractedAnswer.questionNumber,
          grade: gradingResult,
          maxPoints: question.points,
        });

        totalScore += gradingResult.marksAwarded;
        maxScore += question.points;
      }

      const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : '0.0';
      console.log(`\n  Total: ${totalScore}/${maxScore} (${percentage}%)`);

      gradingResults.push({
        studentName: result.studentName,
        totalScore,
        maxScore,
        percentage: parseFloat(percentage),
        questionGrades,
      });
    }

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('');
    console.log('='.repeat(80));
    console.log('📊 FINAL COMPREHENSIVE REPORT');
    console.log('='.repeat(80));
    console.log('');

    console.log('Exam Information:');
    console.log(`  Title: ${exam.title}`);
    console.log(`  Exam ID: ${exam.examId}`);
    console.log(`  Total Questions: ${questionnaire.totalQuestions}`);
    console.log(`  Total Points: ${questionnaire.sections.flatMap(s => s.questions).reduce((sum, q) => sum + q.points, 0)}`);
    console.log(`  Extraction Confidence: ${questionnaire.extractionConfidence}%`);
    console.log('');

    console.log('Student Results (sorted by score):');
    console.log('');

    // Sort by score descending
    gradingResults.sort((a, b) => b.percentage - a.percentage);

    gradingResults.forEach((result, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
      console.log(`${medal} ${rank}. ${result.studentName.padEnd(20)} ${result.totalScore}/${result.maxScore} (${result.percentage}%)`);
    });

    console.log('');
    console.log('Statistics:');
    const avgScore = gradingResults.reduce((sum, r) => sum + r.percentage, 0) / gradingResults.length;
    const avgExtraction = extractionResults.reduce((sum, r) => sum + r.extracted.overallConfidence, 0) / extractionResults.length;
    console.log(`  Average Score: ${avgScore.toFixed(1)}%`);
    console.log(`  Highest Score: ${gradingResults[0].percentage}% (${gradingResults[0].studentName})`);
    console.log(`  Lowest Score: ${gradingResults[gradingResults.length - 1].percentage}% (${gradingResults[gradingResults.length - 1].studentName})`);
    console.log(`  Average Extraction Confidence: ${avgExtraction.toFixed(1)}%`);
    console.log(`  Students Processed: ${extractionResults.length}`);
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ COMPLETE WORKFLOW TEST SUCCESSFUL');
    console.log('='.repeat(80));
    console.log('');
    console.log('Key Achievements:');
    console.log(`  ✓ Extracted ${questionnaire.totalQuestions} questions from PDF questionnaire`);
    console.log(`  ✓ Extracted ${answerKey.length} answer mappings from PDF answer key`);
    console.log(`  ✓ Created exam in database with ID: ${exam.examId}`);
    console.log(`  ✓ Processed ${extractionResults.length} student answer sheets`);
    console.log(`  ✓ Graded all submissions with AI`);
    console.log(`  ✓ Generated comprehensive grading report`);
    console.log('');
    console.log('The system successfully handled real exam documents end-to-end! 🎉');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80));
    console.error(error);
    if (error instanceof Error && error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testCompleteWorkflow();
