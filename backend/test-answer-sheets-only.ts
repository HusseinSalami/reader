/**
 * Test Answer Sheets Processing
 * 
 * Tests handwriting extraction and AI grading using:
 * - The manually created exam (with known questions)
 * - Real student answer sheet images
 */

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
const CUSTOMER_ID = 'test-customer-manual';
const EXAM_ID = 'exam-95b6aeb4-718f-4fa4-bdfc-ff3d2ef37e32'; // From manual creation
const EXAMPLES_DIR = path.join(__dirname, 'examples');

// Set environment variables for services
process.env.AWS_REGION = REGION;
process.env.EXAMS_TABLE_NAME = process.env.EXAMS_TABLE_NAME || 'DocumentPlatform-Exams';
process.env.SUBMISSIONS_TABLE_NAME = process.env.SUBMISSIONS_TABLE_NAME || 'DocumentPlatform-Submissions';
process.env.BUCKET_NAME = BUCKET;

async function testAnswerSheets() {
  console.log('📸 Testing Answer Sheet Processing');
  console.log('='.repeat(80));
  console.log(`Region: ${REGION}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Exam ID: ${EXAM_ID}`);
  console.log(`Examples: ${EXAMPLES_DIR}`);
  console.log('');

  const s3Client = new S3Client({ region: REGION });
  const handwritingRecognizer = new HandwritingRecognizer();
  const gradingEngine = new AIGradingEngine();
  const examService = new ExamManagementService();
  const submissionService = new SubmissionManagementService();

  try {
    // ========================================
    // STEP 1: Get or Create Exam
    // ========================================
    console.log('📋 STEP 1: Retrieving Exam');
    console.log('-'.repeat(80));

    let exam;
    try {
      exam = await examService.getExam(EXAM_ID, CUSTOMER_ID);
      console.log(`✓ Exam found: ${exam.title}`);
    } catch (error) {
      console.log(`⚠ Exam not found, creating new one...`);
      
      // Run the manual exam creation script
      const { execSync } = await import('child_process');
      execSync('npx tsx create-test-exam-manual.ts', { 
        cwd: __dirname,
        stdio: 'inherit'
      });
      
      // The script outputs the exam ID, but we'll just use the latest one
      // For now, let's create it inline
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const { DynamoDBDocumentClient, QueryCommand } = await import('@aws-sdk/lib-dynamodb');
      const dynamoClient = new DynamoDBClient({ region: REGION });
      const docClient = DynamoDBDocumentClient.from(dynamoClient);
      
      // Query for the most recent exam
      const result = await docClient.send(new QueryCommand({
        TableName: process.env.EXAMS_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `CUSTOMER#${CUSTOMER_ID}`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: 1,
      }));
      
      if (!result.Items || result.Items.length === 0) {
        throw new Error('Failed to create exam');
      }
      
      const examRecord = result.Items[0];
      exam = {
        examId: examRecord.examId,
        customerId: examRecord.customerId,
        teacherId: examRecord.teacherId,
        title: examRecord.title,
        createdAt: examRecord.createdAt,
        updatedAt: examRecord.updatedAt,
        questionnaire: {
          sections: examRecord.sections,
          totalQuestions: examRecord.totalQuestions,
          extractionConfidence: 100,
        },
        answerKey: examRecord.answerMappings,
        status: examRecord.status,
        submissionCount: examRecord.submissionCount,
        totalCost: examRecord.totalCost,
      };
      
      console.log(`✓ Exam created: ${exam.examId}`);
    }
    console.log(`  Questions: ${exam.questionnaire.totalQuestions}`);
    console.log(`  Sections: ${exam.questionnaire.sections.length}`);
    console.log('');

    // Show questions
    console.log('Questions in exam:');
    for (const section of exam.questionnaire.sections) {
      console.log(`\n  ${section.sectionTitle}:`);
      for (const question of section.questions) {
        console.log(`    Q${question.questionNumber} (${question.points}pts): ${question.questionText.substring(0, 70)}...`);
      }
    }
    console.log('');

    // ========================================
    // STEP 2: Process All Answer Sheets
    // ========================================
    console.log('📸 STEP 2: Processing All Answer Sheets');
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

    const results = [];

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
      const answerS3Key = `answer-sheets-test/${CUSTOMER_ID}/${answerFile}`;
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
        exam.questionnaire,
        CUSTOMER_ID
      );

      console.log(`✓ Extracted ${extracted.answers.length} answers`);
      console.log(`  Overall confidence: ${extracted.overallConfidence}%`);
      console.log(`  Student ID detected: ${extracted.studentId}`);
      
      if (extracted.flaggedForReview && extracted.flaggedForReview.length > 0) {
        console.log(`  ⚠ Flagged for review: Q${extracted.flaggedForReview.join(', Q')}`);
      }

      // Show extracted answers
      console.log('\n  Extracted answers:');
      extracted.answers.forEach(answer => {
        console.log(`    Q${answer.questionNumber} (${answer.confidence}%): ${answer.extractedText.substring(0, 80)}...`);
      });

      results.push({
        studentName,
        answerFile,
        extracted,
      });
    }

    console.log('');
    console.log(`✓ Processed ${results.length} answer sheets`);
    console.log('');

    // ========================================
    // STEP 3: Grade All Submissions
    // ========================================
    console.log('🤖 STEP 3: AI Grading All Submissions');
    console.log('='.repeat(80));

    const gradingResults = [];

    for (const result of results) {
      console.log(`\n${'-'.repeat(80)}`);
      console.log(`Grading: ${result.studentName}`);
      console.log(`${'-'.repeat(80)}`);

      let totalScore = 0;
      let maxScore = 0;
      const questionGrades = [];

      // Grade all questions
      for (const extractedAnswer of result.extracted.answers) {
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
    console.log('📊 FINAL GRADING SUMMARY');
    console.log('='.repeat(80));
    console.log('');

    // Sort by score descending
    gradingResults.sort((a, b) => b.percentage - a.percentage);

    gradingResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.studentName}: ${result.totalScore}/${result.maxScore} (${result.percentage}%)`);
    });

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Key Findings:');
    console.log(`  • Processed ${results.length} answer sheets`);
    console.log(`  • Average extraction confidence: ${(results.reduce((sum, r) => sum + r.extracted.overallConfidence, 0) / results.length).toFixed(1)}%`);
    console.log(`  • Average score: ${(gradingResults.reduce((sum, r) => sum + r.percentage, 0) / gradingResults.length).toFixed(1)}%`);
    console.log(`  • Highest score: ${gradingResults[0].percentage}% (${gradingResults[0].studentName})`);
    console.log(`  • Lowest score: ${gradingResults[gradingResults.length - 1].percentage}% (${gradingResults[gradingResults.length - 1].studentName})`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

testAnswerSheets();
