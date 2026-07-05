/**
 * SQS Consumer Lambda for Grading Submissions
 * 
 * This Lambda is triggered by SQS messages from the grading queue.
 * It processes one submission per invocation:
 * 1. Extracts handwritten answers using HandwritingRecognizer
 * 2. Grades answers using AIGradingEngine
 * 3. Stores results in DynamoDB via SubmissionManagementService
 * 4. Updates batch status via BatchProcessingService
 * 5. Handles errors gracefully with DLQ
 * 
 * Requirements: 8.6
 * - Process one submission per invocation
 * - Handle failures with DLQ (dead letter queue)
 * - Continue processing on individual failures
 * - Update submission status after processing
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { HandwritingRecognizer } from '../layers/shared/nodejs/handwriting-recognizer';
import { AIGradingEngine } from '../layers/shared/nodejs/ai-grading-engine';
import { BatchProcessingService } from '../layers/shared/nodejs/batch-processing-service';
import {
  SQSSubmissionMessage,
  ExamRecord,
  SubmissionRecord,
  ExtractedAnswers,
  GradingResult,
  ExamContext
} from '../layers/shared/nodejs/exam-types';

const TABLE_NAME = process.env.EXAMS_TABLE_NAME || 'ExamGradingSystem';

// Lazy initialization to avoid issues with mocking in tests
let dynamoClient: DynamoDBClient;
let docClient: DynamoDBDocumentClient;
let handwritingRecognizer: HandwritingRecognizer;
let aiGradingEngine: AIGradingEngine;
let batchProcessingService: BatchProcessingService;

function initializeServices() {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient({});
    docClient = DynamoDBDocumentClient.from(dynamoClient);
    handwritingRecognizer = new HandwritingRecognizer();
    aiGradingEngine = new AIGradingEngine();
    batchProcessingService = new BatchProcessingService();
  }
}

/**
 * Lambda handler for SQS-triggered submission grading
 * 
 * Processes one submission per invocation. If processing fails, the message
 * will be retried according to SQS configuration, and eventually sent to DLQ.
 */
export const handler = async (event: SQSEvent): Promise<void> => {
  // Initialize services on first invocation
  initializeServices();
  
  console.log(`Processing ${event.Records.length} SQS message(s)`);
  
  // Process each record (typically one per invocation)
  for (const record of event.Records) {
    try {
      await processSubmission(record);
    } catch (error) {
      console.error('Error processing submission:', error);
      
      // Extract message details for logging
      const message = parseMessage(record);
      if (message) {
        // Update batch status to FAILED for this submission
        try {
          await batchProcessingService.updateSubmissionStatus(
            message.batchId,
            message.customerId,
            message.submissionId,
            'FAILED',
            error instanceof Error ? error.message : 'Unknown error'
          );
          
          // Update submission record status to FAILED
          await updateSubmissionStatus(
            message.examId,
            message.submissionId,
            'FAILED',
            error instanceof Error ? error.message : 'Unknown error'
          );
        } catch (updateError) {
          console.error('Failed to update failure status:', updateError);
        }
      }
      
      // Re-throw error to trigger SQS retry/DLQ behavior
      throw error;
    }
  }
};

/**
 * Processes a single submission from an SQS message
 */
async function processSubmission(record: SQSRecord): Promise<void> {
  // Parse SQS message
  const message = parseMessage(record);
  if (!message) {
    throw new Error('Invalid SQS message format');
  }
  
  console.log(`Processing submission ${message.submissionId} for student ${message.studentId}`);
  
  // Update batch status to PROCESSING
  await batchProcessingService.updateSubmissionStatus(
    message.batchId,
    message.customerId,
    message.submissionId,
    'PROCESSING'
  );
  
  // Update submission record status to PROCESSING
  await updateSubmissionStatus(
    message.examId,
    message.submissionId,
    'PROCESSING'
  );
  
  // Step 1: Retrieve exam details (questionnaire and answer key)
  const exam = await getExam(message.examId, message.customerId);
  
  if (!exam) {
    throw new Error(`Exam ${message.examId} not found for customer ${message.customerId}`);
  }
  
  // Step 2: Extract handwritten answers using HandwritingRecognizer
  console.log(`Extracting handwritten answers from ${message.documentUrl}`);
  
  const extractedAnswers: ExtractedAnswers = await handwritingRecognizer.extractHandwrittenAnswers(
    message.documentUrl,
    {
      sections: exam.sections,
      totalQuestions: exam.totalQuestions,
      extractionConfidence: 0
    },
    message.customerId
  );
  
  console.log(`Extracted ${extractedAnswers.answers.length} answers with ${extractedAnswers.overallConfidence}% confidence`);
  
  // Step 3: Grade answers using AIGradingEngine
  console.log('Grading submission with AI');
  
  const examContext: ExamContext = {
    examId: exam.examId,
    examTitle: exam.title,
    totalPoints: exam.totalPoints,
    questions: exam.sections.flatMap(section => section.questions)
  };
  
  const gradingResult: GradingResult = await aiGradingEngine.batchGradeSubmission(
    extractedAnswers,
    exam.answerMappings,
    examContext,
    message.customerId
  );
  
  console.log(`Grading complete: ${gradingResult.totalScore}/${gradingResult.maxScore} (${gradingResult.averageConfidence}% confidence)`);
  
  // Step 4: Store results in DynamoDB
  await storeGradingResults(
    message.examId,
    message.submissionId,
    extractedAnswers,
    gradingResult
  );
  
  // Determine final status based on confidence scores
  const requiresReview = gradingResult.decisions.some(d => d.requiresReview);
  const finalStatus = requiresReview ? 'REVIEW_REQUIRED' : 'GRADED';
  
  // Update submission status
  await updateSubmissionStatus(
    message.examId,
    message.submissionId,
    finalStatus
  );
  
  // Step 5: Update batch status to COMPLETED
  await batchProcessingService.updateSubmissionStatus(
    message.batchId,
    message.customerId,
    message.submissionId,
    'COMPLETED'
  );
  
  // Emit progress event
  await batchProcessingService.emitProgressEvent(
    message.batchId,
    {
      submissionId: message.submissionId,
      studentId: message.studentId,
      studentName: message.studentName,
      status: 'COMPLETED',
      processedAt: new Date().toISOString()
    }
  );
  
  console.log(`Successfully processed submission ${message.submissionId}`);
}

/**
 * Parses SQS message body into SQSSubmissionMessage
 */
function parseMessage(record: SQSRecord): SQSSubmissionMessage | null {
  try {
    const message: SQSSubmissionMessage = JSON.parse(record.body);
    
    // Validate required fields
    if (!message.submissionId || !message.batchId || !message.examId || 
        !message.customerId || !message.studentId || !message.documentUrl) {
      console.error('Invalid message: missing required fields', message);
      return null;
    }
    
    return message;
  } catch (error) {
    console.error('Failed to parse SQS message:', error);
    return null;
  }
}

/**
 * Retrieves exam details from DynamoDB
 */
async function getExam(examId: string, customerId: string): Promise<ExamRecord | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`
      }
    }));
    
    return result.Item as ExamRecord | null;
  } catch (error) {
    console.error('Failed to retrieve exam:', error);
    throw error;
  }
}

/**
 * Updates submission status in DynamoDB
 */
async function updateSubmissionStatus(
  examId: string,
  submissionId: string,
  status: 'PROCESSING' | 'GRADED' | 'REVIEW_REQUIRED' | 'FAILED',
  error?: string
): Promise<void> {
  try {
    const updateExpression = error
      ? 'SET #status = :status, processedAt = :processedAt, errorMessage = :error, updatedAt = :updatedAt'
      : 'SET #status = :status, processedAt = :processedAt, updatedAt = :updatedAt';
    
    const expressionAttributeValues: Record<string, any> = {
      ':status': status,
      ':processedAt': new Date().toISOString(),
      ':updatedAt': new Date().toISOString()
    };
    
    if (error) {
      expressionAttributeValues[':error'] = error;
    }
    
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `EXAM#${examId}`,
        SK: `SUBMISSION#${submissionId}`
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: expressionAttributeValues
    }));
  } catch (error) {
    console.error('Failed to update submission status:', error);
    throw error;
  }
}

/**
 * Stores grading results in DynamoDB submission record
 */
async function storeGradingResults(
  examId: string,
  submissionId: string,
  extractedAnswers: ExtractedAnswers,
  gradingResult: GradingResult
): Promise<void> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `EXAM#${examId}`,
        SK: `SUBMISSION#${submissionId}`
      },
      UpdateExpression: `
        SET extractedAnswers = :extractedAnswers,
            extractionConfidence = :extractionConfidence,
            gradingDecisions = :gradingDecisions,
            totalScore = :totalScore,
            maxScore = :maxScore,
            averageConfidence = :averageConfidence,
            gradedAt = :gradedAt,
            costTracking = :costTracking,
            updatedAt = :updatedAt
      `,
      ExpressionAttributeValues: {
        ':extractedAnswers': extractedAnswers,
        ':extractionConfidence': extractedAnswers.overallConfidence,
        ':gradingDecisions': gradingResult.decisions,
        ':totalScore': gradingResult.totalScore,
        ':maxScore': gradingResult.maxScore,
        ':averageConfidence': gradingResult.averageConfidence,
        ':gradedAt': gradingResult.gradedAt,
        ':costTracking': gradingResult.costTracking,
        ':updatedAt': new Date().toISOString()
      }
    }));
    
    console.log(`Stored grading results for submission ${submissionId}`);
  } catch (error) {
    console.error('Failed to store grading results:', error);
    throw error;
  }
}
