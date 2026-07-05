/**
 * SubmissionManagementService
 * 
 * Manages the lifecycle of student submissions including creation, retrieval, 
 * grade updates, and finalization. All operations enforce multi-tenant isolation 
 * using customerId.
 * 
 * DynamoDB Table Structure:
 * - PK: "EXAM#{examId}"
 * - SK: "SUBMISSION#{submissionId}"
 * - GSI1: PK="CUSTOMER#{customerId}", SK="SUBMISSION#{submittedAt}"
 * - GSI2: PK="STUDENT#{studentId}", SK="SUBMISSION#{submittedAt}"
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  Submission,
  SubmissionRecord,
  CreateSubmissionRequest,
  ManualGradeOverride,
  SubmissionManagementService as ISubmissionManagementService
} from './exam-types';

const TABLE_NAME = process.env.SUBMISSIONS_TABLE_NAME || 'ExamGradingSystem-Submissions';

export class SubmissionManagementService implements ISubmissionManagementService {
  private docClient: DynamoDBDocumentClient;
  
  constructor() {
    const dynamoClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
  }
  
  /**
   * Creates a new submission and stores it in DynamoDB
   * 
   * @param submissionData - Submission creation request data
   * @param customerId - Customer identifier for multi-tenant isolation
   * @returns Created submission object
   */
  async createSubmission(
    submissionData: CreateSubmissionRequest,
    customerId: string
  ): Promise<Submission> {
    const submissionId = uuidv4();
    const now = new Date().toISOString();
    
    const submission: Submission = {
      submissionId,
      examId: submissionData.examId,
      customerId,
      studentId: submissionData.studentId,
      studentName: submissionData.studentName,
      submittedAt: now,
      status: 'UPLOADED',
      manualOverrides: [],
      isFinalized: false
    };
    
    const record: SubmissionRecord = {
      PK: `EXAM#${submissionData.examId}`,
      SK: `SUBMISSION#${submissionId}`,
      submissionId,
      examId: submissionData.examId,
      customerId,
      studentId: submissionData.studentId,
      studentName: submissionData.studentName,
      submittedAt: now,
      status: 'UPLOADED',
      documentS3Key: submissionData.documentUrl,
      pageCount: 0,
      manualOverrides: [],
      isFinalized: false,
      GSI1PK: `CUSTOMER#${customerId}`,
      GSI1SK: `SUBMISSION#${now}`,
      GSI2PK: `STUDENT#${submissionData.studentId}`,
      GSI2SK: `SUBMISSION#${now}`
    };
    
    await this.docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: record
    }));
    
    return submission;
  }
  
  /**
   * Retrieves a submission by ID with customer validation
   * 
   * @param submissionId - Submission identifier
   * @param customerId - Customer identifier for access control
   * @returns Submission object or throws error if not found
   */
  async getSubmission(
    submissionId: string,
    customerId: string
  ): Promise<Submission> {
    // We need to query by GSI1 since we don't know the examId
    const result = await this.docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: 'submissionId = :submissionId',
      ExpressionAttributeValues: {
        ':pk': `CUSTOMER#${customerId}`,
        ':submissionId': submissionId
      }
    }));
    
    if (!result.Items || result.Items.length === 0) {
      throw new Error(`Submission ${submissionId} not found for customer ${customerId}`);
    }
    
    const record = result.Items[0] as SubmissionRecord;
    
    return this.recordToSubmission(record);
  }
  
  /**
   * Lists all submissions for an exam with customer validation
   * 
   * @param examId - Exam identifier
   * @param customerId - Customer identifier for access control
   * @returns Array of submissions for the exam
   */
  async listSubmissions(
    examId: string,
    customerId: string
  ): Promise<Submission[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'customerId = :customerId',
      ExpressionAttributeValues: {
        ':pk': `EXAM#${examId}`,
        ':sk': 'SUBMISSION#',
        ':customerId': customerId
      }
    }));
    
    if (!result.Items) {
      return [];
    }
    
    return result.Items.map(item => this.recordToSubmission(item as SubmissionRecord));
  }
  
  /**
   * Updates a grade for a specific question with manual override
   * Stores both original AI grade and manual override with metadata
   * 
   * @param submissionId - Submission identifier
   * @param questionNumber - Question number to update
   * @param manualGrade - Manual grade override with reason and reviewer info
   * @param customerId - Customer identifier for access control
   */
  async updateGrade(
    submissionId: string,
    questionNumber: string,
    manualGrade: ManualGradeOverride,
    customerId: string
  ): Promise<void> {
    // First, get the submission to find its examId (needed for PK)
    const submission = await this.getSubmission(submissionId, customerId);
    
    // Validate that the manual grade has required fields
    if (!manualGrade.reason || manualGrade.reason.trim().length === 0) {
      throw new Error('Manual grade override requires a non-empty reason');
    }
    
    if (!manualGrade.reviewedBy || manualGrade.reviewedBy.trim().length === 0) {
      throw new Error('Manual grade override requires reviewedBy identifier');
    }
    
    // Ensure timestamp is set
    if (!manualGrade.reviewedAt) {
      manualGrade.reviewedAt = new Date().toISOString();
    }
    
    // Get existing manual overrides
    const existingOverrides = submission.manualOverrides || [];
    
    // Check if there's already an override for this question
    const existingIndex = existingOverrides.findIndex(
      override => override.questionNumber === questionNumber
    );
    
    let updatedOverrides: ManualGradeOverride[];
    
    if (existingIndex >= 0) {
      // Update existing override
      updatedOverrides = [...existingOverrides];
      updatedOverrides[existingIndex] = manualGrade;
    } else {
      // Add new override
      updatedOverrides = [...existingOverrides, manualGrade];
    }
    
    // Update the submission record
    await this.docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `EXAM#${submission.examId}`,
        SK: `SUBMISSION#${submissionId}`
      },
      UpdateExpression: 'SET manualOverrides = :overrides',
      ConditionExpression: 'attribute_exists(PK) AND customerId = :customerId',
      ExpressionAttributeValues: {
        ':overrides': updatedOverrides,
        ':customerId': customerId
      }
    }));
  }
  
  /**
   * Finalizes a submission, marking it as complete and reviewed
   * Once finalized, the submission should not be modified further
   * 
   * @param submissionId - Submission identifier
   * @param customerId - Customer identifier for access control
   */
  async finalizeSubmission(
    submissionId: string,
    customerId: string
  ): Promise<void> {
    // First, get the submission to find its examId (needed for PK)
    const submission = await this.getSubmission(submissionId, customerId);
    
    const now = new Date().toISOString();
    
    // Update the submission to mark as finalized
    await this.docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `EXAM#${submission.examId}`,
        SK: `SUBMISSION#${submissionId}`
      },
      UpdateExpression: 'SET isFinalized = :isFinalized, finalizedAt = :finalizedAt, #status = :status',
      ConditionExpression: 'attribute_exists(PK) AND customerId = :customerId',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':isFinalized': true,
        ':finalizedAt': now,
        ':status': 'FINALIZED',
        ':customerId': customerId
      }
    }));
  }
  
  // ========================================
  // Private Helper Methods
  // ========================================
  
  /**
   * Converts DynamoDB record to Submission object
   */
  private recordToSubmission(record: SubmissionRecord): Submission {
    return {
      submissionId: record.submissionId,
      examId: record.examId,
      customerId: record.customerId,
      studentId: record.studentId,
      studentName: record.studentName,
      submittedAt: record.submittedAt,
      processedAt: record.processedAt,
      status: record.status,
      extractedAnswers: record.extractedAnswers,
      gradingResult: record.gradingDecisions ? {
        submissionId: record.submissionId,
        studentId: record.studentId,
        examId: record.examId,
        decisions: record.gradingDecisions,
        totalScore: record.totalScore || 0,
        maxScore: record.maxScore || 0,
        averageConfidence: record.averageConfidence || 0,
        gradedAt: record.gradedAt || '',
        costTracking: record.costTracking || {
          textractPages: 0,
          textractCost: 0,
          bedrockTokensInput: 0,
          bedrockTokensOutput: 0,
          bedrockCost: 0,
          totalCost: 0
        }
      } : undefined,
      manualOverrides: record.manualOverrides || [],
      isFinalized: record.isFinalized
    };
  }
}
