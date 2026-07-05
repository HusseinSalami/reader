/**
 * Unit tests for SQS Consumer Lambda (grade-submission)
 * 
 * Tests cover:
 * - Successful submission processing workflow
 * - Error handling and DLQ behavior
 * - Status updates after processing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { 
  SQSSubmissionMessage,
  ExamRecord,
  ExtractedAnswers,
  GradingResult,
  CostTracking
} from '../layers/shared/nodejs/exam-types';

// Create mocks
const dynamoMock = mockClient(DynamoDBDocumentClient);
const mockExtractHandwrittenAnswers = vi.fn();
const mockBatchGradeSubmission = vi.fn();
const mockUpdateSubmissionStatus = vi.fn();
const mockEmitProgressEvent = vi.fn();

// Set environment variables
process.env.EXAMS_TABLE_NAME = 'TestExamsTable';

// Mock services
vi.mock('../layers/shared/nodejs/handwriting-recognizer', () => ({
  HandwritingRecognizer: vi.fn().mockImplementation(() => ({
    extractHandwrittenAnswers: mockExtractHandwrittenAnswers
  }))
}));

vi.mock('../layers/shared/nodejs/ai-grading-engine', () => ({
  AIGradingEngine: vi.fn().mockImplementation(() => ({
    batchGradeSubmission: mockBatchGradeSubmission
  }))
}));

vi.mock('../layers/shared/nodejs/batch-processing-service', () => ({
  BatchProcessingService: vi.fn().mockImplementation(() => ({
    updateSubmissionStatus: mockUpdateSubmissionStatus,
    emitProgressEvent: mockEmitProgressEvent
  }))
}));

describe('SQS Consumer Lambda - grade-submission', () => {
  const customerId = 'customer-123';
  const examId = 'exam-456';
  const submissionId = 'submission-789';
  const batchId = 'batch-abc';
  
  beforeEach(() => {
    dynamoMock.reset();
    mockExtractHandwrittenAnswers.mockReset();
    mockBatchGradeSubmission.mockReset();
    mockUpdateSubmissionStatus.mockReset();
    mockEmitProgressEvent.mockReset();
    
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  /**
   * Helper function to create SQS event
   */
  function createSQSEvent(message: SQSSubmissionMessage): SQSEvent {
    const record: SQSRecord = {
      messageId: 'msg-123',
      receiptHandle: 'receipt-123',
      body: JSON.stringify(message),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1234567890',
        SenderId: 'sender-123',
        ApproximateFirstReceiveTimestamp: '1234567890'
      },
      messageAttributes: {},
      md5OfBody: 'md5-123',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123456789:grading-queue',
      awsRegion: 'us-east-1'
    };
    
    return {
      Records: [record]
    };
  }
  
  /**
   * Helper function to create mock exam record
   */
  function createMockExam(): ExamRecord {
    return {
      PK: `CUSTOMER#${customerId}`,
      SK: `EXAM#${examId}`,
      examId,
      customerId,
      teacherId: 'teacher-001',
      title: 'Math Final Exam',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'ACTIVE',
      questionnaireS3Key: 's3://bucket/questionnaire.pdf',
      sections: [
        {
          sectionNumber: 1,
          sectionTitle: 'Algebra',
          questions: [
            {
              questionNumber: 'Q1',
              questionText: 'What is 2 + 2?',
              points: 5,
              sectionId: 'section-1'
            },
            {
              questionNumber: 'Q2',
              questionText: 'Solve for x: 2x + 5 = 15',
              points: 10,
              sectionId: 'section-1'
            }
          ]
        }
      ],
      totalQuestions: 2,
      totalPoints: 15,
      answerKeyS3Key: 's3://bucket/answer-key.pdf',
      answerMappings: [
        {
          questionNumber: 'Q1',
          expectedAnswer: '4',
          keywords: ['four', '4']
        },
        {
          questionNumber: 'Q2',
          expectedAnswer: 'x = 5',
          keywords: ['5', 'five']
        }
      ],
      submissionCount: 0,
      totalCost: 0,
      GSI1PK: 'TEACHER#teacher-001',
      GSI1SK: 'EXAM#2024-01-01T00:00:00Z'
    };
  }
  
  /**
   * Helper function to create mock extracted answers
   */
  function createMockExtractedAnswers(): ExtractedAnswers {
    return {
      studentId: 'student-123',
      answers: [
        {
          questionNumber: 'Q1',
          extractedText: '4',
          confidence: 95,
          boundingBox: { top: 0.1, left: 0.1, width: 0.2, height: 0.1 }
        },
        {
          questionNumber: 'Q2',
          extractedText: 'x = 5',
          confidence: 90,
          boundingBox: { top: 0.3, left: 0.1, width: 0.3, height: 0.1 }
        }
      ],
      overallConfidence: 92.5,
      flaggedForReview: []
    };
  }
  
  /**
   * Helper function to create mock grading result
   */
  function createMockGradingResult(): GradingResult {
    const costTracking: CostTracking = {
      textractPages: 2,
      textractCost: 0.003,
      bedrockTokensInput: 500,
      bedrockTokensOutput: 200,
      bedrockCost: 0.0021,
      totalCost: 0.0051
    };
    
    return {
      submissionId,
      studentId: 'student-123',
      examId,
      decisions: [
        {
          questionNumber: 'Q1',
          marksAwarded: 5,
          maxMarks: 5,
          confidence: 95,
          explanation: 'Correct answer',
          isPartialCredit: false,
          requiresReview: false
        },
        {
          questionNumber: 'Q2',
          marksAwarded: 10,
          maxMarks: 10,
          confidence: 90,
          explanation: 'Correct solution',
          isPartialCredit: false,
          requiresReview: false
        }
      ],
      totalScore: 15,
      maxScore: 15,
      averageConfidence: 92.5,
      gradedAt: '2024-01-15T10:00:00.000Z',
      costTracking
    };
  }
  
  describe('Successful processing workflow', () => {
    it('should process submission end-to-end successfully', async () => {
      const { handler } = await import('./grade-submission');
      
      const message: SQSSubmissionMessage = {
        submissionId,
        batchId,
        examId,
        customerId,
        studentId: 'student-123',
        studentName: 'Alice Johnson',
        documentUrl: 's3://bucket/submissions/student-123.pdf'
      };
      
      const event = createSQSEvent(message);
      const mockExam = createMockExam();
      const mockExtracted = createMockExtractedAnswers();
      const mockGrading = createMockGradingResult();
      
      // Mock DynamoDB responses
      dynamoMock.on(GetCommand).resolves({ Item: mockExam });
      dynamoMock.on(UpdateCommand).resolves({});
      
      // Mock service responses
      mockExtractHandwrittenAnswers.mockResolvedValueOnce(mockExtracted);
      mockBatchGradeSubmission.mockResolvedValueOnce(mockGrading);
      mockUpdateSubmissionStatus.mockResolvedValue(undefined);
      mockEmitProgressEvent.mockResolvedValue(undefined);
      
      // Execute handler
      await handler(event);
      
      // Verify batch status updated to PROCESSING
      expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(
        batchId,
        customerId,
        submissionId,
        'PROCESSING'
      );
      
      // Verify handwriting extraction was called
      expect(mockExtractHandwrittenAnswers).toHaveBeenCalledWith(
        message.documentUrl,
        expect.objectContaining({
          sections: mockExam.sections,
          totalQuestions: mockExam.totalQuestions
        }),
        customerId
      );
      
      // Verify AI grading was called
      expect(mockBatchGradeSubmission).toHaveBeenCalledWith(
        mockExtracted,
        mockExam.answerMappings,
        expect.objectContaining({
          examId,
          examTitle: mockExam.title,
          totalPoints: mockExam.totalPoints
        }),
        customerId
      );
      
      // Verify batch status updated to COMPLETED
      expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(
        batchId,
        customerId,
        submissionId,
        'COMPLETED'
      );
      
      // Verify progress event was emitted
      expect(mockEmitProgressEvent).toHaveBeenCalledWith(
        batchId,
        expect.objectContaining({
          submissionId,
          studentId: 'student-123',
          studentName: 'Alice Johnson',
          status: 'COMPLETED'
        })
      );
    });
    
    it('should set status to REVIEW_REQUIRED when confidence is low', async () => {
      const { handler } = await import('./grade-submission');
      
      const message: SQSSubmissionMessage = {
        submissionId,
        batchId,
        examId,
        customerId,
        studentId: 'student-123',
        studentName: 'Bob Smith',
        documentUrl: 's3://bucket/submissions/student-123.pdf'
      };
      
      const event = createSQSEvent(message);
      const mockExam = createMockExam();
      const mockExtracted = createMockExtractedAnswers();
      
      // Create grading result with low confidence
      const mockGrading: GradingResult = {
        ...createMockGradingResult(),
        decisions: [
          {
            questionNumber: 'Q1',
            marksAwarded: 3,
            maxMarks: 5,
            confidence: 65,
            explanation: 'Partially correct',
            isPartialCredit: true,
            requiresReview: true // Flagged for review
          },
          {
            questionNumber: 'Q2',
            marksAwarded: 10,
            maxMarks: 10,
            confidence: 90,
            explanation: 'Correct',
            isPartialCredit: false,
            requiresReview: false
          }
        ],
        averageConfidence: 77.5
      };
      
      dynamoMock.on(GetCommand).resolves({ Item: mockExam });
      dynamoMock.on(UpdateCommand).resolves({});
      
      mockExtractHandwrittenAnswers.mockResolvedValueOnce(mockExtracted);
      mockBatchGradeSubmission.mockResolvedValueOnce(mockGrading);
      mockUpdateSubmissionStatus.mockResolvedValue(undefined);
      mockEmitProgressEvent.mockResolvedValue(undefined);
      
      await handler(event);
      
      // Verify submission status was set to REVIEW_REQUIRED
      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      const statusUpdateCall = updateCalls.find(
        call => call.args[0].input.ExpressionAttributeValues?.[':status'] === 'REVIEW_REQUIRED'
      );
      expect(statusUpdateCall).toBeDefined();
    });
  });
  
  describe('Error handling', () => {
    it('should handle invalid SQS message format', async () => {
      const { handler } = await import('./grade-submission');
      
      const invalidRecord: SQSRecord = {
        messageId: 'msg-123',
        receiptHandle: 'receipt-123',
        body: 'invalid json',
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1234567890',
          SenderId: 'sender-123',
          ApproximateFirstReceiveTimestamp: '1234567890'
        },
        messageAttributes: {},
        md5OfBody: 'md5-123',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:123456789:grading-queue',
        awsRegion: 'us-east-1'
      };
      
      const event: SQSEvent = { Records: [invalidRecord] };
      
      await expect(handler(event)).rejects.toThrow('Invalid SQS message format');
    });
    
    it('should handle missing required fields in message', async () => {
      const { handler } = await import('./grade-submission');
      
      const incompleteMessage = {
        submissionId,
        batchId,
        // Missing examId, customerId, studentId, documentUrl
      };
      
      const record: SQSRecord = {
        messageId: 'msg-123',
        receiptHandle: 'receipt-123',
        body: JSON.stringify(incompleteMessage),
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1234567890',
          SenderId: 'sender-123',
          ApproximateFirstReceiveTimestamp: '1234567890'
        },
        messageAttributes: {},
        md5OfBody: 'md5-123',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:123456789:grading-queue',
        awsRegion: 'us-east-1'
      };
      
      const event: SQSEvent = { Records: [record] };
      
      await expect(handler(event)).rejects.toThrow('Invalid SQS message format');
    });
    
    it('should handle exam not found error', async () => {
      const { handler } = await import('./grade-submission');
      
      const message: SQSSubmissionMessage = {
        submissionId,
        batchId,
        examId,
        customerId,
        studentId: 'student-123',
        studentName: 'Eve Adams',
        documentUrl: 's3://bucket/submissions/student-123.pdf'
      };
      
      const event = createSQSEvent(message);
      
      // Mock exam not found
      dynamoMock.on(GetCommand).resolves({ Item: null });
      dynamoMock.on(UpdateCommand).resolves({});
      mockUpdateSubmissionStatus.mockResolvedValue(undefined);
      
      await expect(handler(event)).rejects.toThrow(`Exam ${examId} not found`);
      
      // Verify failure was recorded
      expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(
        batchId,
        customerId,
        submissionId,
        'FAILED',
        expect.stringContaining('Exam')
      );
    });
  });
});
