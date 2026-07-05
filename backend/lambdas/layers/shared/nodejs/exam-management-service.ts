/**
 * ExamManagementService
 * 
 * Manages the lifecycle of exams including creation, retrieval, updates, and deletion.
 * All operations enforce multi-tenant isolation using customerId.
 * 
 * DynamoDB Table Structure:
 * - PK: "CUSTOMER#{customerId}"
 * - SK: "EXAM#{examId}"
 * - GSI1: PK="TEACHER#{teacherId}", SK="EXAM#{createdAt}"
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  Exam,
  ExamRecord,
  CreateExamRequest,
  ExamFilters,
  Question,
  ExamManagementService as IExamManagementService
} from './exam-types';
import { DocumentProcessor } from './document-processor';

const TABLE_NAME = process.env.EXAMS_TABLE_NAME || 'ExamGradingSystem';

export class ExamManagementService implements IExamManagementService {
  private docClient: DynamoDBDocumentClient;
  
  constructor() {
    const dynamoClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
  }
  
  /**
   * Creates a new exam and stores it in DynamoDB
   * 
   * @param examData - Exam creation request data
   * @param customerId - Customer identifier for multi-tenant isolation
   * @returns Created exam object
   */
  async createExam(
    examData: CreateExamRequest,
    customerId: string
  ): Promise<Exam> {
    const examId = uuidv4();
    const now = new Date().toISOString();
    
    // Process questionnaire to extract questions
    const documentProcessor = new DocumentProcessor();
    const questionnaireResult = await documentProcessor.extractQuestionsFromQuestionnaire(
      examData.questionnaireUrl,
      customerId
    );
    
    // Process answer key to extract mappings
    const answerKeyResult = await documentProcessor.extractAnswerKeyMappings(
      examData.answerKeyUrl,
      customerId
    );
    
    // Calculate total points
    const totalPoints = questionnaireResult.sections.reduce(
      (sum, section) => sum + section.questions.reduce((s, q) => s + q.points, 0),
      0
    );
    
    const exam: Exam = {
      examId,
      customerId,
      teacherId: examData.teacherId,
      title: examData.title,
      createdAt: now,
      updatedAt: now,
      questionnaire: {
        sections: questionnaireResult.sections,
        totalQuestions: questionnaireResult.totalQuestions,
        extractionConfidence: questionnaireResult.extractionConfidence
      },
      answerKey: answerKeyResult.mappings,
      status: 'DRAFT',
      submissionCount: 0,
      totalCost: questionnaireResult.cost + answerKeyResult.cost
    };
    
    const record: ExamRecord = {
      PK: `CUSTOMER#${customerId}`,
      SK: `EXAM#${examId}`,
      examId,
      customerId,
      teacherId: examData.teacherId,
      title: examData.title,
      createdAt: now,
      updatedAt: now,
      status: 'DRAFT',
      questionnaireS3Key: examData.questionnaireUrl,
      sections: questionnaireResult.sections,
      totalQuestions: questionnaireResult.totalQuestions,
      totalPoints: totalPoints,
      answerKeyS3Key: examData.answerKeyUrl,
      answerMappings: answerKeyResult.mappings,
      submissionCount: 0,
      totalCost: questionnaireResult.cost + answerKeyResult.cost,
      GSI1PK: `TEACHER#${examData.teacherId}`,
      GSI1SK: `EXAM#${now}`
    };
    
    await this.docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: record
    }));
    
    return exam;
  }
  
  /**
   * Retrieves an exam by ID with customer validation
   * 
   * @param examId - Exam identifier
   * @param customerId - Customer identifier for access control
   * @returns Exam object or throws error if not found
   */
  async getExam(
    examId: string,
    customerId: string
  ): Promise<Exam> {
    const result = await this.docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`
      }
    }));
    
    if (!result.Item) {
      throw new Error(`Exam ${examId} not found for customer ${customerId}`);
    }
    
    const record = result.Item as ExamRecord;
    
    return this.recordToExam(record);
  }
  
  /**
   * Lists all exams for a customer with optional filtering
   * 
   * @param customerId - Customer identifier
   * @param filters - Optional filters for status, teacher, date range
   * @returns Array of exams matching the filters
   */
  async listExams(
    customerId: string,
    filters?: ExamFilters
  ): Promise<Exam[]> {
    // If filtering by teacher, use GSI1
    if (filters?.teacherId) {
      return this.listExamsByTeacher(customerId, filters.teacherId, filters);
    }
    
    // Otherwise query by customer
    const result = await this.docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `CUSTOMER#${customerId}`,
        ':sk': 'EXAM#'
      }
    }));
    
    if (!result.Items) {
      return [];
    }
    
    let exams = result.Items.map(item => this.recordToExam(item as ExamRecord));
    
    // Apply filters
    if (filters) {
      exams = this.applyFilters(exams, filters);
    }
    
    return exams;
  }
  
  /**
   * Updates exam questions (used by wizard for editing extracted questions)
   * 
   * @param examId - Exam identifier
   * @param questions - Updated questions array
   * @param customerId - Customer identifier for access control
   */
  async updateExamQuestions(
    examId: string,
    questions: Question[],
    customerId: string
  ): Promise<void> {
    // Group questions by section
    const sectionsMap = new Map<string, Question[]>();
    
    for (const question of questions) {
      if (!sectionsMap.has(question.sectionId)) {
        sectionsMap.set(question.sectionId, []);
      }
      sectionsMap.get(question.sectionId)!.push(question);
    }
    
    // Convert to sections array
    const sections = Array.from(sectionsMap.entries()).map(([sectionId, sectionQuestions], index) => ({
      sectionNumber: index + 1,
      sectionTitle: sectionId,
      questions: sectionQuestions
    }));
    
    const totalQuestions = questions.length;
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const now = new Date().toISOString();
    
    await this.docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`
      },
      UpdateExpression: 'SET sections = :sections, totalQuestions = :totalQuestions, totalPoints = :totalPoints, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':sections': sections,
        ':totalQuestions': totalQuestions,
        ':totalPoints': totalPoints,
        ':updatedAt': now
      },
      ConditionExpression: 'attribute_exists(PK)'
    }));
  }
  
  /**
   * Deletes an exam and all associated submissions (cascade deletion)
   * 
   * @param examId - Exam identifier
   * @param customerId - Customer identifier for access control
   */
  async deleteExam(
    examId: string,
    customerId: string
  ): Promise<void> {
    // First, query for all submissions associated with this exam
    const submissionsResult = await this.docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `EXAM#${examId}`,
        ':sk': 'SUBMISSION#'
      }
    }));
    
    // Delete all submissions in batches (max 25 per batch)
    if (submissionsResult.Items && submissionsResult.Items.length > 0) {
      const deleteRequests = submissionsResult.Items.map(item => ({
        DeleteRequest: {
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }
      }));
      
      // Process in batches of 25
      for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        await this.docClient.send(new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch
          }
        }));
      }
    }
    
    // Finally, delete the exam itself
    await this.docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`
      },
      ConditionExpression: 'attribute_exists(PK)'
    }));
  }
  
  // ========================================
  // Private Helper Methods
  // ========================================
  
  /**
   * Lists exams by teacher using GSI1
   */
  private async listExamsByTeacher(
    customerId: string,
    teacherId: string,
    filters?: ExamFilters
  ): Promise<Exam[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TEACHER#${teacherId}`,
        ':sk': 'EXAM#'
      }
    }));
    
    if (!result.Items) {
      return [];
    }
    
    // Filter by customer ID (since GSI doesn't include it in key)
    let exams = result.Items
      .filter(item => item.customerId === customerId)
      .map(item => this.recordToExam(item as ExamRecord));
    
    // Apply additional filters
    if (filters) {
      exams = this.applyFilters(exams, filters);
    }
    
    return exams;
  }
  
  /**
   * Applies filters to exam list
   */
  private applyFilters(exams: Exam[], filters: ExamFilters): Exam[] {
    let filtered = exams;
    
    if (filters.status) {
      filtered = filtered.filter(exam => exam.status === filters.status);
    }
    
    if (filters.createdAfter) {
      filtered = filtered.filter(exam => exam.createdAt >= filters.createdAfter!);
    }
    
    if (filters.createdBefore) {
      filtered = filtered.filter(exam => exam.createdAt <= filters.createdBefore!);
    }
    
    return filtered;
  }
  
  /**
   * Converts DynamoDB record to Exam object
   */
  private recordToExam(record: ExamRecord): Exam {
    return {
      examId: record.examId,
      customerId: record.customerId,
      teacherId: record.teacherId,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      questionnaire: {
        sections: record.sections,
        totalQuestions: record.totalQuestions,
        extractionConfidence: 0 // Not stored in record, would come from processing
      },
      answerKey: record.answerMappings,
      status: record.status,
      submissionCount: record.submissionCount,
      totalCost: record.totalCost
    };
  }
}
