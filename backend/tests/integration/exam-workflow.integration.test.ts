/**
 * Integration Test: Complete Exam Grading Workflow
 * 
 * Tests the entire workflow using real exam documents:
 * 1. Verify pre-created exam exists
 * 2. Upload student submissions (handwritten JPEGs)
 * 3. Grade submissions using AI
 * 4. Verify complete workflow
 * 
 * Prerequisites:
 * - Run backend/create-test-exam-manual.ts first to create the test exam
 * - Ensure AWS credentials are valid and not expired
 * - Set AWS_REGION environment variable (defaults to us-east-1)
 * 
 * Usage:
 *   AWS_REGION=us-east-1 npm test -- tests/integration/exam-workflow.integration.test.ts
 */

// CRITICAL: Import setup FIRST to configure environment variables
import './setup';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { HandwritingRecognizer } from '../../lambdas/layers/shared/nodejs/handwriting-recognizer';
import { AIGradingEngine } from '../../lambdas/layers/shared/nodejs/ai-grading-engine';
import { ExamManagementService } from '../../lambdas/layers/shared/nodejs/exam-management-service';
import { SubmissionManagementService } from '../../lambdas/layers/shared/nodejs/submission-management-service';
import type { Exam, QuestionContext } from '../../lambdas/layers/shared/nodejs/exam-types';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const TEST_BUCKET = process.env.BUCKET_NAME || 'document-platform-380018306486-us-east-1';
const TEST_CUSTOMER_ID = 'test-customer-manual';
const EXAMPLES_DIR = path.join(__dirname, '../../examples');
const TEST_EXAM_ID = 'exam-ae502cd2-13f5-4681-ad09-2b9dba91c1e0'; // From manual creation

// AWS clients
let s3Client: S3Client;
let handwritingRecognizer: HandwritingRecognizer;
let gradingEngine: AIGradingEngine;
let examService: ExamManagementService;
let submissionService: SubmissionManagementService;

// Test data
let studentAnswerS3Urls: string[] = [];
let testExamId: string;
let testSubmissionIds: string[] = [];

describe('Exam Grading Workflow Integration Test', () => {
  beforeAll(async () => {
    // Initialize AWS clients
    s3Client = new S3Client({ region: AWS_REGION });

    // Initialize services (environment variables already set by setup.ts)
    handwritingRecognizer = new HandwritingRecognizer();
    gradingEngine = new AIGradingEngine();
    examService = new ExamManagementService();
    submissionService = new SubmissionManagementService();

    console.log('✓ Services initialized');
    console.log(`✓ Using pre-created exam: ${TEST_EXAM_ID}`);
  });

  afterAll(async () => {
    // Cleanup: Delete uploaded S3 files
    const deletePromises = studentAnswerS3Urls
      .filter(Boolean)
      .map(async (url) => {
        try {
          const { bucket, key } = parseS3Url(url);
          await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        } catch (error) {
          console.warn(`Failed to delete S3 object: ${url}`, error);
        }
      });

    await Promise.all(deletePromises);
    console.log('✓ S3 cleanup completed');
  });

  describe('Step 1: Verify Pre-Created Exam', () => {
    it('should retrieve the manually created exam', async () => {
      const exam: Exam = await examService.getExam(TEST_EXAM_ID, TEST_CUSTOMER_ID);

      console.log(`✓ Exam retrieved: ${exam.title}`);
      console.log(`  Total questions: ${exam.questionnaire.totalQuestions}`);
      console.log(`  Sections: ${exam.questionnaire.sections.length}`);
      console.log(`  Answer key entries: ${exam.answerKey.length}`);

      expect(exam.examId).toBe(TEST_EXAM_ID);
      expect(exam.questionnaire.totalQuestions).toBeGreaterThan(0);
      expect(exam.questionnaire.sections.length).toBeGreaterThan(0);
      expect(exam.answerKey.length).toBeGreaterThan(0);

      testExamId = TEST_EXAM_ID;
    }, 30000);
  });

  describe('Step 2: Upload Student Submissions', () => {
    it('should upload student answer images to S3', async () => {
      const answerFiles = [
        'answer1.jpeg',
        'answer2.jpeg',
        'answer3.jpeg',
        'answer4.jpeg',
        'answer5.jpeg',
      ];

      for (const answerFile of answerFiles) {
        const filePath = path.join(EXAMPLES_DIR, answerFile);
        
        if (!fs.existsSync(filePath)) {
          console.warn(`⚠ Answer file not found: ${answerFile}`);
          continue;
        }

        const fileContent = fs.readFileSync(filePath);
        const s3Key = `test-submissions/${TEST_CUSTOMER_ID}/${answerFile}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: TEST_BUCKET,
          Key: s3Key,
          Body: fileContent,
          ContentType: 'image/jpeg',
        }));

        const s3Url = `s3://${TEST_BUCKET}/${s3Key}`;
        studentAnswerS3Urls.push(s3Url);
        console.log(`✓ Uploaded: ${answerFile}`);
      }

      expect(studentAnswerS3Urls.length).toBeGreaterThan(0);
    }, 60000);

    it('should extract handwritten text from student submissions', async () => {
      expect(studentAnswerS3Urls.length).toBeGreaterThan(0);
      expect(testExamId).toBeDefined();

      // Get exam structure
      const exam: Exam = await examService.getExam(testExamId, TEST_CUSTOMER_ID);

      // Test with first student submission
      const firstSubmissionUrl = studentAnswerS3Urls[0];
      
      const extracted = await handwritingRecognizer.extractHandwrittenAnswers(
        firstSubmissionUrl,
        exam.questionnaire,
        TEST_CUSTOMER_ID
      );

      console.log(`✓ Extracted ${extracted.answers.length} answers from first submission`);
      console.log(`  Overall confidence: ${extracted.overallConfidence}%`);

      // Log extracted answers
      extracted.answers.slice(0, 3).forEach((answer) => {
        console.log(`  Q${answer.questionNumber}: ${answer.extractedText.substring(0, 60)}... (${answer.confidence}%)`);
      });

      expect(extracted.answers.length).toBeGreaterThan(0);
      expect(extracted.overallConfidence).toBeGreaterThan(0);
    }, 90000);
  });

  describe('Step 3: Grade Submissions', () => {
    it('should create submission records', async () => {
      expect(testExamId).toBeDefined();
      expect(studentAnswerS3Urls.length).toBeGreaterThan(0);

      const studentNames = ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson', 'Eve Martinez'];

      for (let i = 0; i < Math.min(studentAnswerS3Urls.length, studentNames.length); i++) {
        const submission = await submissionService.createSubmission({
          examId: testExamId,
          studentId: `student-${i + 1}`,
          studentName: studentNames[i],
          documentUrl: studentAnswerS3Urls[i],
        }, TEST_CUSTOMER_ID);

        testSubmissionIds.push(submission.submissionId);
        console.log(`✓ Created submission for ${studentNames[i]}: ${submission.submissionId}`);
      }

      expect(testSubmissionIds.length).toBeGreaterThan(0);
    }, 60000);

    it('should grade first submission using AI', async () => {
      expect(testExamId).toBeDefined();
      expect(testSubmissionIds.length).toBeGreaterThan(0);

      // Get exam details
      const exam: Exam = await examService.getExam(testExamId, TEST_CUSTOMER_ID);
      expect(exam).toBeDefined();

      // Get first submission
      const submissionId = testSubmissionIds[0];
      const submission = await submissionService.getSubmission(submissionId, TEST_CUSTOMER_ID);
      expect(submission).toBeDefined();

      // Extract handwritten answers
      const extracted = await handwritingRecognizer.extractHandwrittenAnswers(
        submission.extractedAnswers?.answers[0]?.extractedText || studentAnswerS3Urls[0],
        exam.questionnaire,
        TEST_CUSTOMER_ID
      );

      console.log(`✓ Extracted ${extracted.answers.length} answers for grading`);

      // Grade each answer
      const gradingResults = [];
      for (const extractedAnswer of extracted.answers.slice(0, 3)) { // Test first 3 questions
        const expectedAnswer = exam.answerKey.find(
          (ak) => ak.questionNumber === extractedAnswer.questionNumber
        );

        if (!expectedAnswer) {
          console.warn(`⚠ No expected answer for Q${extractedAnswer.questionNumber}`);
          continue;
        }

        const question = exam.questionnaire.sections
          .flatMap((s) => s.questions)
          .find((q) => q.questionNumber === extractedAnswer.questionNumber);

        if (!question) {
          console.warn(`⚠ No question found for Q${extractedAnswer.questionNumber}`);
          continue;
        }

        console.log(`\n  Grading Q${extractedAnswer.questionNumber}...`);
        console.log(`    Student answer: ${extractedAnswer.extractedText.substring(0, 100)}...`);
        console.log(`    Expected answer: ${expectedAnswer.expectedAnswer.substring(0, 100)}...`);

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
          TEST_CUSTOMER_ID
        );

        gradingResults.push(gradingResult);

        console.log(`    ✓ Grade: ${gradingResult.marksAwarded}/${question.points}`);
        console.log(`    Confidence: ${gradingResult.confidence}%`);
        console.log(`    Explanation: ${gradingResult.explanation.substring(0, 100)}...`);
      }

      expect(gradingResults.length).toBeGreaterThan(0);
      gradingResults.forEach((result) => {
        expect(result.marksAwarded).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        expect(result.explanation).toBeTruthy();
      });
    }, 180000); // 3 minutes for AI grading
  });

  describe('Step 4: Verify Complete Workflow', () => {
    it('should retrieve exam with all data', async () => {
      expect(testExamId).toBeDefined();

      const exam: Exam = await examService.getExam(testExamId, TEST_CUSTOMER_ID);

      console.log(`\n✓ Exam verification:`);
      console.log(`  Title: ${exam.title}`);
      console.log(`  Total questions: ${exam.questionnaire.totalQuestions}`);
      console.log(`  Sections: ${exam.questionnaire.sections.length}`);
      console.log(`  Answer key entries: ${exam.answerKey.length}`);

      expect(exam.examId).toBe(testExamId);
      expect(exam.questionnaire.totalQuestions).toBeGreaterThan(0);
      expect(exam.questionnaire.sections.length).toBeGreaterThan(0);
      expect(exam.answerKey.length).toBeGreaterThan(0);
    }, 30000);

    it('should list all submissions for exam', async () => {
      expect(testExamId).toBeDefined();

      const submissions = await submissionService.listSubmissions(testExamId, TEST_CUSTOMER_ID);

      console.log(`\n✓ Submissions verification:`);
      console.log(`  Total submissions: ${submissions.length}`);
      submissions.forEach((sub) => {
        console.log(`    - ${sub.studentName}: ${sub.status}`);
      });

      expect(submissions.length).toBe(testSubmissionIds.length);
    }, 30000);
  });
});

// Helper function to parse S3 URL
function parseS3Url(s3Url: string): { bucket: string; key: string } {
  const match = s3Url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid S3 URL format: ${s3Url}`);
  }
  return { bucket: match[1], key: match[2] };
}
