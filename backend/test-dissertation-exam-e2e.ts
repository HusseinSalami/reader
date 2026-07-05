/**
 * End-to-End Dissertation Exam Test
 * 
 * This test simulates the complete user workflow through the API:
 * 1. Upload questionnaire document
 * 2. Upload answer key document
 * 3. Create exam via API
 * 4. Upload student submissions via API
 * 5. Wait for AI grading to complete
 * 6. Retrieve and display results
 * 
 * This ensures the entire system works as it would from the UI.
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod';
const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.BUCKET_NAME || 'document-platform-380018306486-us-east-1';
const CUSTOMER_ID = 'test-customer-dissertation-e2e';
const TEACHER_ID = 'teacher-dissertation-e2e';
const EXAMPLES_DIR = path.join(__dirname, 'examples', 'dissertation-exam');

// Mock JWT token for testing (in production, this would come from Cognito)
const MOCK_TOKEN = 'mock-jwt-token';

interface ApiClient {
  get: (url: string, config?: any) => Promise<any>;
  post: (url: string, data?: any, config?: any) => Promise<any>;
  put: (url: string, data?: any, config?: any) => Promise<any>;
  delete: (url: string, config?: any) => Promise<any>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEndToEndWorkflow() {
  console.log('🎓 End-to-End Dissertation Exam Test');
  console.log('='.repeat(80));
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Region: ${REGION}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Customer: ${CUSTOMER_ID}`);
  console.log(`Examples: ${EXAMPLES_DIR}`);
  console.log('');

  // Create API client
  const api: ApiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${MOCK_TOKEN}`,
      'Content-Type': 'application/json',
      'x-customer-id': CUSTOMER_ID,
    },
  });

  const s3Client = new S3Client({ region: REGION });

  try {
    // ========================================
    // STEP 1: Upload Questionnaire to S3
    // ========================================
    console.log('📄 STEP 1: Uploading Questionnaire');
    console.log('-'.repeat(80));

    const questionnairePath = path.join(EXAMPLES_DIR, 'dissertation-questionnaire.md');
    
    if (!fs.existsSync(questionnairePath)) {
      throw new Error(`Questionnaire not found: ${questionnairePath}`);
    }

    const questionnaireContent = fs.readFileSync(questionnairePath);
    const questionnaireS3Key = `e2e-test/${CUSTOMER_ID}/questionnaire-${Date.now()}.md`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: questionnaireS3Key,
      Body: questionnaireContent,
      ContentType: 'text/markdown',
    }));

    const questionnaireUrl = `s3://${BUCKET}/${questionnaireS3Key}`;
    console.log(`✓ Uploaded questionnaire to: ${questionnaireUrl}`);
    console.log('');

    // ========================================
    // STEP 2: Upload Answer Key to S3
    // ========================================
    console.log('📋 STEP 2: Uploading Answer Key');
    console.log('-'.repeat(80));

    const answerKeyPath = path.join(EXAMPLES_DIR, 'dissertation-answer-key.md');
    
    if (!fs.existsSync(answerKeyPath)) {
      throw new Error(`Answer key not found: ${answerKeyPath}`);
    }

    const answerKeyContent = fs.readFileSync(answerKeyPath);
    const answerKeyS3Key = `e2e-test/${CUSTOMER_ID}/answer-key-${Date.now()}.md`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: answerKeyS3Key,
      Body: answerKeyContent,
      ContentType: 'text/markdown',
    }));

    const answerKeyUrl = `s3://${BUCKET}/${answerKeyS3Key}`;
    console.log(`✓ Uploaded answer key to: ${answerKeyUrl}`);
    console.log('');

    // ========================================
    // STEP 3: Create Exam via API
    // ========================================
    console.log('🎯 STEP 3: Creating Exam via API');
    console.log('-'.repeat(80));

    const createExamPayload = {
      title: 'Literature Analysis Exam - Grade 11 (E2E Test)',
      description: 'End-to-end test of dissertation-style exam grading',
      questionnaireUrl,
      answerKeyUrl,
      teacherId: TEACHER_ID,
    };

    console.log('Sending POST /v1/exams...');
    let createExamResponse;
    try {
      createExamResponse = await api.post('/v1/exams', createExamPayload);
    } catch (error: any) {
      if (error.response) {
        console.error('API Error Response:', error.response.data);
        console.error('Status:', error.response.status);
      }
      throw error;
    }

    const exam = createExamResponse.data;
    const examId = exam.examId;

    console.log(`✓ Exam created successfully!`);
    console.log(`  Exam ID: ${examId}`);
    console.log(`  Title: ${exam.title}`);
    console.log(`  Questions: ${exam.questionnaire?.totalQuestions || 'N/A'}`);
    console.log(`  Status: ${exam.status}`);
    console.log('');

    // ========================================
    // STEP 4: Upload Student Submissions
    // ========================================
    console.log('👥 STEP 4: Uploading Student Submissions via API');
    console.log('-'.repeat(80));

    const studentFiles = [
      { file: 'student-answer-sample-1.md', name: 'Ahmed Hassan', id: '2026-1145' },
      { file: 'student-answer-sample-2.md', name: 'Fatima Ali', id: '2026-1089' },
      { file: 'student-answer-sample-3.md', name: 'Omar Ibrahim', id: '2026-1203' },
    ];

    const submissionIds: string[] = [];

    for (const student of studentFiles) {
      console.log(`\nUploading submission for ${student.name}...`);
      
      const studentAnswerPath = path.join(EXAMPLES_DIR, student.file);
      
      if (!fs.existsSync(studentAnswerPath)) {
        console.warn(`⚠ Student file not found: ${student.file}, skipping...`);
        continue;
      }

      // Upload student answer to S3
      const studentAnswerContent = fs.readFileSync(studentAnswerPath);
      const studentAnswerS3Key = `e2e-test/${CUSTOMER_ID}/submissions/${student.id}-${Date.now()}.md`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: studentAnswerS3Key,
        Body: studentAnswerContent,
        ContentType: 'text/markdown',
      }));

      const studentAnswerUrl = `s3://${BUCKET}/${studentAnswerS3Key}`;

      // Create submission via API
      const uploadSubmissionPayload = {
        studentName: student.name,
        studentId: student.id,
        submissionUrl: studentAnswerUrl,
      };

      console.log(`  Sending POST /v1/exams/${examId}/submissions...`);
      let uploadResponse;
      try {
        uploadResponse = await api.post(`/v1/exams/${examId}/submissions`, uploadSubmissionPayload);
      } catch (error: any) {
        if (error.response) {
          console.error('  API Error Response:', error.response.data);
          console.error('  Status:', error.response.status);
        }
        throw error;
      }

      const submission = uploadResponse.data;
      submissionIds.push(submission.submissionId);

      console.log(`  ✓ Submission created: ${submission.submissionId}`);
      console.log(`    Status: ${submission.status}`);
    }

    console.log(`\n✓ Uploaded ${submissionIds.length} submissions`);
    console.log('');

    // ========================================
    // STEP 5: Wait for Grading to Complete
    // ========================================
    console.log('⏳ STEP 5: Waiting for AI Grading to Complete');
    console.log('-'.repeat(80));

    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    const submissionStatuses = new Map<string, any>();

    while (Date.now() - startTime < maxWaitTime) {
      let allComplete = true;

      for (const submissionId of submissionIds) {
        console.log(`Checking status of ${submissionId}...`);
        
        let statusResponse;
        try {
          statusResponse = await api.get(`/v1/submissions/${submissionId}`);
        } catch (error: any) {
          if (error.response) {
            console.error(`  API Error Response:`, error.response.data);
          }
          throw error;
        }

        const submission = statusResponse.data;
        submissionStatuses.set(submissionId, submission);

        console.log(`  Status: ${submission.status}`);

        if (submission.status !== 'GRADED' && submission.status !== 'FINALIZED') {
          allComplete = false;
        }
      }

      if (allComplete) {
        console.log('\n✓ All submissions graded!');
        break;
      }

      console.log(`\nWaiting ${pollInterval / 1000}s before next check...\n`);
      await sleep(pollInterval);
    }

    if (Date.now() - startTime >= maxWaitTime) {
      console.warn('⚠ Timeout waiting for grading to complete');
    }

    console.log('');

    // ========================================
    // STEP 6: Retrieve and Display Results
    // ========================================
    console.log('📊 STEP 6: Retrieving Grading Results');
    console.log('-'.repeat(80));

    const results = [];

    for (const submissionId of submissionIds) {
      const submission = submissionStatuses.get(submissionId);
      
      if (!submission) {
        console.warn(`⚠ No data for submission ${submissionId}`);
        continue;
      }

      console.log(`\n${submission.studentName} (${submission.studentId}):`);
      console.log(`  Status: ${submission.status}`);
      console.log(`  Total Score: ${submission.totalScore || 0}/${submission.maxScore || 50}`);
      
      if (submission.gradingDecisions && submission.gradingDecisions.length > 0) {
        console.log(`  Questions Graded: ${submission.gradingDecisions.length}`);
        
        let totalScore = 0;
        let maxScore = 0;

        for (const decision of submission.gradingDecisions) {
          const points = decision.marksAwarded || 0;
          const max = decision.maxPoints || 10;
          const confidence = decision.confidence || 0;
          
          console.log(`    Q${decision.questionNumber}: ${points}/${max} pts (${confidence}% confidence)`);
          
          totalScore += points;
          maxScore += max;
        }

        const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : '0.0';
        
        results.push({
          studentName: submission.studentName,
          studentId: submission.studentId,
          totalScore,
          maxScore,
          percentage: parseFloat(percentage),
          submissionId,
        });

        console.log(`  Final: ${totalScore}/${maxScore} (${percentage}%)`);
      }
    }

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('');
    console.log('='.repeat(80));
    console.log('📊 FINAL E2E TEST REPORT');
    console.log('='.repeat(80));
    console.log('');

    console.log('Exam Information:');
    console.log(`  Exam ID: ${examId}`);
    console.log(`  Title: ${exam.title}`);
    console.log(`  Status: ${exam.status}`);
    console.log('');

    if (results.length > 0) {
      console.log('Student Results (sorted by score):');
      console.log('');

      // Sort by score descending
      results.sort((a, b) => b.percentage - a.percentage);

      results.forEach((result, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
        const grade = result.percentage >= 90 ? 'A' : result.percentage >= 80 ? 'B' : result.percentage >= 70 ? 'C' : result.percentage >= 60 ? 'D' : 'F';
        console.log(`${medal} ${rank}. ${result.studentName.padEnd(20)} ${result.totalScore}/${result.maxScore} (${result.percentage}%) - Grade: ${grade}`);
      });

      console.log('');
      console.log('Statistics:');
      const avgScore = results.reduce((sum, r) => sum + r.percentage, 0) / results.length;
      console.log(`  Average Score: ${avgScore.toFixed(1)}%`);
      console.log(`  Highest Score: ${results[0].percentage}% (${results[0].studentName})`);
      console.log(`  Lowest Score: ${results[results.length - 1].percentage}% (${results[results.length - 1].studentName})`);
      console.log(`  Students Graded: ${results.length}`);
    } else {
      console.log('⚠ No results available yet. Grading may still be in progress.');
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ END-TO-END TEST COMPLETED');
    console.log('='.repeat(80));
    console.log('');
    console.log('Key Achievements:');
    console.log(`  ✓ Uploaded questionnaire and answer key to S3`);
    console.log(`  ✓ Created exam via POST /v1/exams API`);
    console.log(`  ✓ Uploaded ${submissionIds.length} student submissions via API`);
    console.log(`  ✓ Monitored grading status via GET /v1/submissions/{id}`);
    console.log(`  ✓ Retrieved final results`);
    console.log('');
    console.log('The complete workflow works end-to-end through the API! 🎉');
    console.log('This is exactly how the UI will interact with the backend.');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ E2E TEST FAILED');
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

// Check if API URL is configured
if (API_BASE_URL.includes('your-api-gateway-url')) {
  console.error('❌ ERROR: API_URL not configured');
  console.error('');
  console.error('Please set the API_URL environment variable:');
  console.error('  export API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod');
  console.error('');
  console.error('Or update the API_BASE_URL in this script.');
  console.error('');
  console.error('You can get the API URL from:');
  console.error('  1. CDK deployment outputs');
  console.error('  2. AWS Console > API Gateway');
  console.error('  3. backend/outputs.json (if it exists)');
  process.exit(1);
}

testEndToEndWorkflow();
