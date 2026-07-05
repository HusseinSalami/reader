/**
 * Unit tests for ExamManagementService
 * 
 * Tests cover:
 * - Exam creation with proper DynamoDB record structure
 * - Exam retrieval with customer validation
 * - Exam listing with filtering
 * - Question updates
 * - Cascade deletion
 * - Multi-tenant isolation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreateExamRequest, Question, ExamFilters } from './exam-types';

// Create mock send function
const mockSend = vi.fn();

// Mock AWS SDK BEFORE importing the service
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend }))
  },
  PutCommand: vi.fn((input) => ({ input })),
  GetCommand: vi.fn((input) => ({ input })),
  QueryCommand: vi.fn((input) => ({ input })),
  UpdateCommand: vi.fn((input) => ({ input })),
  DeleteCommand: vi.fn((input) => ({ input })),
  BatchWriteCommand: vi.fn((input) => ({ input }))
}));

// Import service AFTER mocks are set up
import { ExamManagementService } from './exam-management-service';

describe('ExamManagementService', () => {
  let service: ExamManagementService;
  const customerId = 'customer-123';
  const teacherId = 'teacher-456';
  const examId = 'exam-789';
  
  beforeEach(() => {
    mockSend.mockReset();
    service = new ExamManagementService();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('createExam', () => {
    it('should create exam with correct DynamoDB record structure', async () => {
      const examData: CreateExamRequest = {
        title: 'Math Final Exam',
        questionnaireUrl: 's3://bucket/questionnaire.pdf',
        answerKeyUrl: 's3://bucket/answer-key.docx',
        teacherId
      };
      
      mockSend.mockResolvedValueOnce({});
      
      const result = await service.createExam(examData, customerId);
      
      expect(result).toMatchObject({
        customerId,
        teacherId,
        title: 'Math Final Exam',
        status: 'DRAFT',
        submissionCount: 0,
        totalCost: 0
      });
      
      expect(result.examId).toBeDefined();
      expect(result.createdAt).toBe('2024-01-15T10:00:00.000Z');
      expect(result.updatedAt).toBe('2024-01-15T10:00:00.000Z');
      
      // Verify DynamoDB record structure
      expect(mockSend).toHaveBeenCalledTimes(1);
      const putCommand = mockSend.mock.calls[0][0];
      const item = putCommand.input.Item;
      
      expect(item).toMatchObject({
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${result.examId}`,
        examId: result.examId,
        customerId,
        teacherId,
        title: 'Math Final Exam',
        status: 'DRAFT',
        questionnaireS3Key: 's3://bucket/questionnaire.pdf',
        answerKeyS3Key: 's3://bucket/answer-key.docx',
        GSI1PK: `TEACHER#${teacherId}`,
        GSI1SK: `EXAM#2024-01-15T10:00:00.000Z`
      });
    });
    
    it('should initialize exam with empty questionnaire and answer key', async () => {
      const examData: CreateExamRequest = {
        title: 'Test Exam',
        questionnaireUrl: 's3://bucket/test.pdf',
        answerKeyUrl: 's3://bucket/key.pdf',
        teacherId
      };
      
      mockSend.mockResolvedValueOnce({});
      
      const result = await service.createExam(examData, customerId);
      
      expect(result.questionnaire).toEqual({
        sections: [],
        totalQuestions: 0,
        extractionConfidence: 0
      });
      expect(result.answerKey).toEqual([]);
    });
  });
  
  describe('getExam', () => {
    it('should retrieve exam by ID with customer validation', async () => {
      const mockRecord = {
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`,
        examId,
        customerId,
        teacherId,
        title: 'Physics Exam',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        status: 'ACTIVE',
        questionnaireS3Key: 's3://bucket/questionnaire.pdf',
        sections: [
          {
            sectionNumber: 1,
            sectionTitle: 'Mechanics',
            questions: [
              {
                questionNumber: '1',
                questionText: 'What is Newton\'s first law?',
                points: 10,
                sectionId: 'Mechanics'
              }
            ]
          }
        ],
        totalQuestions: 1,
        totalPoints: 10,
        answerKeyS3Key: 's3://bucket/answer-key.pdf',
        answerMappings: [
          {
            questionNumber: '1',
            expectedAnswer: 'An object at rest stays at rest...',
            keywords: ['inertia', 'motion', 'force']
          }
        ],
        submissionCount: 5,
        totalCost: 12.50,
        GSI1PK: `TEACHER#${teacherId}`,
        GSI1SK: `EXAM#2024-01-15T10:00:00.000Z`
      };
      
      mockSend.mockResolvedValueOnce({ Item: mockRecord });
      
      const result = await service.getExam(examId, customerId);
      
      expect(result).toMatchObject({
        examId,
        customerId,
        teacherId,
        title: 'Physics Exam',
        status: 'ACTIVE',
        submissionCount: 5,
        totalCost: 12.50
      });
      
      expect(result.questionnaire.sections).toHaveLength(1);
      expect(result.answerKey).toHaveLength(1);
      
      // Verify correct key was used
      const getCommand = mockSend.mock.calls[0][0];
      expect(getCommand.input.Key).toEqual({
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`
      });
    });
    
    it('should throw error if exam not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      
      await expect(
        service.getExam(examId, customerId)
      ).rejects.toThrow(`Exam ${examId} not found for customer ${customerId}`);
    });
    
    it('should enforce customer isolation', async () => {
      const wrongCustomerId = 'wrong-customer';
      
      mockSend.mockResolvedValueOnce({ Item: undefined });
      
      await expect(
        service.getExam(examId, wrongCustomerId)
      ).rejects.toThrow();
      
      // Verify it queried with the wrong customer ID
      const getCommand = mockSend.mock.calls[0][0];
      expect(getCommand.input.Key).toEqual({
        PK: `CUSTOMER#${wrongCustomerId}`,
        SK: `EXAM#${examId}`
      });
    });
  });
  
  describe('listExams', () => {
    const mockExams = [
      {
        PK: `CUSTOMER#${customerId}`,
        SK: 'EXAM#exam-1',
        examId: 'exam-1',
        customerId,
        teacherId,
        title: 'Math Exam',
        createdAt: '2024-01-10T10:00:00.000Z',
        updatedAt: '2024-01-10T10:00:00.000Z',
        status: 'ACTIVE',
        questionnaireS3Key: 's3://bucket/q1.pdf',
        sections: [],
        totalQuestions: 10,
        totalPoints: 100,
        answerKeyS3Key: 's3://bucket/a1.pdf',
        answerMappings: [],
        submissionCount: 3,
        totalCost: 5.0,
        GSI1PK: `TEACHER#${teacherId}`,
        GSI1SK: 'EXAM#2024-01-10T10:00:00.000Z'
      },
      {
        PK: `CUSTOMER#${customerId}`,
        SK: 'EXAM#exam-2',
        examId: 'exam-2',
        customerId,
        teacherId,
        title: 'Science Exam',
        createdAt: '2024-01-12T10:00:00.000Z',
        updatedAt: '2024-01-12T10:00:00.000Z',
        status: 'DRAFT',
        questionnaireS3Key: 's3://bucket/q2.pdf',
        sections: [],
        totalQuestions: 15,
        totalPoints: 150,
        answerKeyS3Key: 's3://bucket/a2.pdf',
        answerMappings: [],
        submissionCount: 0,
        totalCost: 0,
        GSI1PK: `TEACHER#${teacherId}`,
        GSI1SK: 'EXAM#2024-01-12T10:00:00.000Z'
      }
    ];
    
    it('should list all exams for customer', async () => {
      mockSend.mockResolvedValueOnce({ Items: mockExams });
      
      const result = await service.listExams(customerId);
      
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Math Exam');
      expect(result[1].title).toBe('Science Exam');
      
      // Verify query parameters
      const queryCommand = mockSend.mock.calls[0][0];
      expect(queryCommand.input.KeyConditionExpression).toBe('PK = :pk AND begins_with(SK, :sk)');
      expect(queryCommand.input.ExpressionAttributeValues).toEqual({
        ':pk': `CUSTOMER#${customerId}`,
        ':sk': 'EXAM#'
      });
    });
    
    it('should return empty array if no exams found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      
      const result = await service.listExams(customerId);
      
      expect(result).toEqual([]);
    });
    
    it('should filter by status', async () => {
      mockSend.mockResolvedValueOnce({ Items: mockExams });
      
      const filters: ExamFilters = { status: 'ACTIVE' };
      const result = await service.listExams(customerId, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('ACTIVE');
      expect(result[0].title).toBe('Math Exam');
    });
    
    it('should filter by date range', async () => {
      mockSend.mockResolvedValueOnce({ Items: mockExams });
      
      const filters: ExamFilters = {
        createdAfter: '2024-01-11T00:00:00.000Z',
        createdBefore: '2024-01-13T00:00:00.000Z'
      };
      const result = await service.listExams(customerId, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Science Exam');
    });
    
    it('should filter by teacher using GSI1', async () => {
      mockSend.mockResolvedValueOnce({ Items: mockExams });
      
      const filters: ExamFilters = { teacherId };
      const result = await service.listExams(customerId, filters);
      
      expect(result).toHaveLength(2);
      
      // Verify GSI1 was used
      const queryCommand = mockSend.mock.calls[0][0];
      expect(queryCommand.input.IndexName).toBe('GSI1');
      expect(queryCommand.input.KeyConditionExpression).toBe('GSI1PK = :pk AND begins_with(GSI1SK, :sk)');
      expect(queryCommand.input.ExpressionAttributeValues).toEqual({
        ':pk': `TEACHER#${teacherId}`,
        ':sk': 'EXAM#'
      });
    });
    
    it('should filter by teacher and status', async () => {
      mockSend.mockResolvedValueOnce({ Items: mockExams });
      
      const filters: ExamFilters = { teacherId, status: 'DRAFT' };
      const result = await service.listExams(customerId, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Science Exam');
      expect(result[0].status).toBe('DRAFT');
    });
  });
  
  describe('updateExamQuestions', () => {
    it('should update questions and recalculate totals', async () => {
      const questions: Question[] = [
        {
          questionNumber: '1',
          questionText: 'What is 2+2?',
          points: 5,
          sectionId: 'Arithmetic'
        },
        {
          questionNumber: '2',
          questionText: 'What is 3+3?',
          points: 5,
          sectionId: 'Arithmetic'
        },
        {
          questionNumber: '3',
          questionText: 'What is 10-5?',
          points: 10,
          sectionId: 'Subtraction'
        }
      ];
      
      mockSend.mockResolvedValueOnce({});
      
      await service.updateExamQuestions(examId, questions, customerId);
      
      const updateCommand = mockSend.mock.calls[0][0];
      const input = updateCommand.input;
      
      expect(input.Key).toEqual({
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`
      });
      
      expect(input.UpdateExpression).toBe(
        'SET sections = :sections, totalQuestions = :totalQuestions, totalPoints = :totalPoints, updatedAt = :updatedAt'
      );
      
      const values = input.ExpressionAttributeValues;
      expect(values[':totalQuestions']).toBe(3);
      expect(values[':totalPoints']).toBe(20);
      expect(values[':sections']).toHaveLength(2);
      expect(values[':updatedAt']).toBe('2024-01-15T10:00:00.000Z');
      
      // Verify sections are grouped correctly
      const sections = values[':sections'];
      expect(sections[0].sectionTitle).toBe('Arithmetic');
      expect(sections[0].questions).toHaveLength(2);
      expect(sections[1].sectionTitle).toBe('Subtraction');
      expect(sections[1].questions).toHaveLength(1);
    });
    
    it('should handle single question update', async () => {
      const questions: Question[] = [
        {
          questionNumber: '1',
          questionText: 'Single question',
          points: 15,
          sectionId: 'Section A'
        }
      ];
      
      mockSend.mockResolvedValueOnce({});
      
      await service.updateExamQuestions(examId, questions, customerId);
      
      const updateCommand = mockSend.mock.calls[0][0];
      const values = updateCommand.input.ExpressionAttributeValues;
      
      expect(values[':totalQuestions']).toBe(1);
      expect(values[':totalPoints']).toBe(15);
      expect(values[':sections']).toHaveLength(1);
    });
    
    it('should enforce condition that exam exists', async () => {
      const questions: Question[] = [
        {
          questionNumber: '1',
          questionText: 'Test',
          points: 10,
          sectionId: 'Test'
        }
      ];
      
      mockSend.mockResolvedValueOnce({});
      
      await service.updateExamQuestions(examId, questions, customerId);
      
      const updateCommand = mockSend.mock.calls[0][0];
      expect(updateCommand.input.ConditionExpression).toBe('attribute_exists(PK)');
    });
  });
  
  describe('deleteExam', () => {
    it('should delete exam and cascade delete submissions', async () => {
      const mockSubmissions = [
        {
          PK: `EXAM#${examId}`,
          SK: 'SUBMISSION#sub-1'
        },
        {
          PK: `EXAM#${examId}`,
          SK: 'SUBMISSION#sub-2'
        },
        {
          PK: `EXAM#${examId}`,
          SK: 'SUBMISSION#sub-3'
        }
      ];
      
      mockSend
        .mockResolvedValueOnce({ Items: mockSubmissions }) // Query submissions
        .mockResolvedValueOnce({}) // BatchWrite
        .mockResolvedValueOnce({}); // Delete exam
      
      await service.deleteExam(examId, customerId);
      
      expect(mockSend).toHaveBeenCalledTimes(3);
      
      // Verify submissions were queried
      const queryCommand = mockSend.mock.calls[0][0];
      expect(queryCommand.input.KeyConditionExpression).toBe('PK = :pk AND begins_with(SK, :sk)');
      expect(queryCommand.input.ExpressionAttributeValues).toEqual({
        ':pk': `EXAM#${examId}`,
        ':sk': 'SUBMISSION#'
      });
      
      // Verify batch delete was called
      const batchCommand = mockSend.mock.calls[1][0];
      const tableName = process.env.EXAMS_TABLE_NAME || 'ExamGradingSystem';
      const deleteRequests = batchCommand.input.RequestItems[tableName];
      expect(deleteRequests).toHaveLength(3);
      
      // Verify exam was deleted
      const deleteCommand = mockSend.mock.calls[2][0];
      expect(deleteCommand.input.Key).toEqual({
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`
      });
      expect(deleteCommand.input.ConditionExpression).toBe('attribute_exists(PK)');
    });
    
    it('should handle deletion when no submissions exist', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [] }) // Query submissions
        .mockResolvedValueOnce({}); // Delete exam
      
      await service.deleteExam(examId, customerId);
      
      // Verify no batch delete was called (only query and delete)
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
    
    it('should handle large number of submissions in batches', async () => {
      // Create 60 mock submissions (requires 3 batches of 25, 25, 10)
      const mockSubmissions = Array.from({ length: 60 }, (_, i) => ({
        PK: `EXAM#${examId}`,
        SK: `SUBMISSION#sub-${i}`
      }));
      
      mockSend
        .mockResolvedValueOnce({ Items: mockSubmissions }) // Query
        .mockResolvedValueOnce({}) // Batch 1
        .mockResolvedValueOnce({}) // Batch 2
        .mockResolvedValueOnce({}) // Batch 3
        .mockResolvedValueOnce({}); // Delete exam
      
      await service.deleteExam(examId, customerId);
      
      // Verify 5 calls: 1 query + 3 batch deletes + 1 delete exam
      expect(mockSend).toHaveBeenCalledTimes(5);
      
      // Verify batch sizes
      const tableName = process.env.EXAMS_TABLE_NAME || 'ExamGradingSystem';
      const batch1 = mockSend.mock.calls[1][0].input.RequestItems[tableName];
      const batch2 = mockSend.mock.calls[2][0].input.RequestItems[tableName];
      const batch3 = mockSend.mock.calls[3][0].input.RequestItems[tableName];
      
      expect(batch1).toHaveLength(25);
      expect(batch2).toHaveLength(25);
      expect(batch3).toHaveLength(10);
    });
  });
  
  describe('Multi-tenant isolation', () => {
    it('should include customerId in all DynamoDB operations', async () => {
      const examData: CreateExamRequest = {
        title: 'Test',
        questionnaireUrl: 's3://test',
        answerKeyUrl: 's3://test',
        teacherId
      };
      
      const mockRecord = {
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`,
        examId,
        customerId,
        teacherId,
        title: 'Test',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        status: 'DRAFT',
        questionnaireS3Key: 's3://test',
        sections: [],
        totalQuestions: 0,
        totalPoints: 0,
        answerKeyS3Key: 's3://test',
        answerMappings: [],
        submissionCount: 0,
        totalCost: 0,
        GSI1PK: `TEACHER#${teacherId}`,
        GSI1SK: 'EXAM#2024-01-15T10:00:00.000Z'
      };
      
      // Create
      mockSend.mockResolvedValueOnce({});
      await service.createExam(examData, customerId);
      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input.Item.PK).toBe(`CUSTOMER#${customerId}`);
      expect(putCommand.input.Item.customerId).toBe(customerId);
      
      mockSend.mockReset();
      
      // Get
      mockSend.mockResolvedValueOnce({ Item: mockRecord });
      await service.getExam(examId, customerId);
      const getCommand = mockSend.mock.calls[0][0];
      expect(getCommand.input.Key.PK).toBe(`CUSTOMER#${customerId}`);
      
      mockSend.mockReset();
      
      // List
      mockSend.mockResolvedValueOnce({ Items: [] });
      await service.listExams(customerId);
      const queryCommand = mockSend.mock.calls[0][0];
      expect(queryCommand.input.ExpressionAttributeValues[':pk']).toBe(`CUSTOMER#${customerId}`);
      
      mockSend.mockReset();
      
      // Update
      mockSend.mockResolvedValueOnce({});
      await service.updateExamQuestions(examId, [], customerId);
      const updateCommand = mockSend.mock.calls[0][0];
      expect(updateCommand.input.Key.PK).toBe(`CUSTOMER#${customerId}`);
      
      mockSend.mockReset();
      
      // Delete
      mockSend.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({});
      await service.deleteExam(examId, customerId);
      const deleteCommand = mockSend.mock.calls[1][0];
      expect(deleteCommand.input.Key.PK).toBe(`CUSTOMER#${customerId}`);
    });
  });
});
