/**
 * Shared TypeScript interfaces for the AI-Powered Exam Grading System
 * 
 * This file contains all data models used across Lambda functions for:
 * - Exam management (questionnaires, answer keys)
 * - Student submissions
 * - AI grading results
 * - Cost tracking
 * 
 * All models include customerId for multi-tenant isolation.
 */

// ========================================
// Document Processing Types
// ========================================

export type DocumentFormat = 'PDF' | 'DOCX' | 'IMAGE';

export interface BoundingBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ========================================
// Exam Structure Types
// ========================================

export interface Question {
  questionNumber: string;
  questionText: string;
  points: number;
  sectionId: string;
}

export interface Section {
  sectionNumber: number;
  sectionTitle: string;
  questions: Question[];
}

export interface ExtractedQuestionnaire {
  sections: Section[];
  totalQuestions: number;
  extractionConfidence: number;
}

export interface AnswerKeyMapping {
  questionNumber: string;
  expectedAnswer: string;
  keywords: string[];
}

// ========================================
// Exam Management Types
// ========================================

export type ExamStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface Exam {
  examId: string;
  customerId: string;
  teacherId: string;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  questionnaire: ExtractedQuestionnaire;
  answerKey: AnswerKeyMapping[];
  status: ExamStatus;
  submissionCount: number;
  totalCost: number;
}

export interface CreateExamRequest {
  title: string;
  questionnaireUrl: string;
  answerKeyUrl: string;
  teacherId: string;
}

export interface ExamFilters {
  status?: ExamStatus;
  teacherId?: string;
  createdAfter?: string;
  createdBefore?: string;
}

// ========================================
// DynamoDB Record Types
// ========================================

export interface ExamRecord {
  // Partition Key
  PK: string; // "CUSTOMER#{customerId}"
  
  // Sort Key
  SK: string; // "EXAM#{examId}"
  
  // Attributes
  examId: string;
  customerId: string;
  teacherId: string;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  status: ExamStatus;
  
  // Questionnaire data
  questionnaireS3Key: string;
  sections: Section[];
  totalQuestions: number;
  totalPoints: number;
  
  // Answer key data
  answerKeyS3Key: string;
  answerMappings: AnswerKeyMapping[];
  
  // Metadata
  submissionCount: number;
  totalCost: number;
  
  // GSI attributes
  GSI1PK: string; // "TEACHER#{teacherId}"
  GSI1SK: string; // "EXAM#{createdAt}"
}

// ========================================
// Student Submission Types
// ========================================

export type SubmissionStatus = 
  | 'UPLOADED' 
  | 'PROCESSING' 
  | 'GRADED' 
  | 'REVIEW_REQUIRED' 
  | 'FINALIZED' 
  | 'FAILED';

export interface StudentAnswer {
  questionNumber: string;
  extractedText: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface ExtractedAnswers {
  studentId: string;
  answers: StudentAnswer[];
  overallConfidence: number;
  flaggedForReview: string[]; // question numbers
}

export interface ManualGradeOverride {
  questionNumber: string;
  originalMarks: number;
  overriddenMarks: number;
  reason: string;
  reviewedBy: string;
  reviewedAt: string; // ISO 8601
}

export interface Submission {
  submissionId: string;
  examId: string;
  customerId: string;
  studentId: string;
  studentName: string;
  submittedAt: string; // ISO 8601
  processedAt?: string; // ISO 8601
  status: SubmissionStatus;
  extractedAnswers?: ExtractedAnswers;
  gradingResult?: GradingResult;
  manualOverrides: ManualGradeOverride[];
  isFinalized: boolean;
}

export interface CreateSubmissionRequest {
  examId: string;
  studentId: string;
  studentName: string;
  documentUrl: string;
}

// ========================================
// AI Grading Types
// ========================================

export interface QuestionContext {
  questionNumber: string;
  questionText: string;
  maxPoints: number;
  keywords: string[];
}

export interface ExamContext {
  examId: string;
  examTitle: string;
  totalPoints: number;
  questions: Question[];
}

export interface GradingDecision {
  questionNumber: string;
  marksAwarded: number;
  maxMarks: number;
  confidence: number; // 0-100
  explanation: string;
  isPartialCredit: boolean;
  requiresReview: boolean;
}

export interface GradingResult {
  submissionId: string;
  studentId: string;
  examId: string;
  decisions: GradingDecision[];
  totalScore: number;
  maxScore: number;
  averageConfidence: number;
  gradedAt: string; // ISO 8601
  costTracking: CostTracking;
}

// ========================================
// Cost Tracking Types
// ========================================

export interface CostTracking {
  textractPages: number;
  textractCost: number;
  bedrockTokensInput: number;
  bedrockTokensOutput: number;
  bedrockCost: number;
  totalCost: number;
}

// ========================================
// DynamoDB Submission Record
// ========================================

export interface SubmissionRecord {
  // Partition Key
  PK: string; // "EXAM#{examId}"
  
  // Sort Key
  SK: string; // "SUBMISSION#{submissionId}"
  
  // Attributes
  submissionId: string;
  examId: string;
  customerId: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  processedAt?: string;
  status: SubmissionStatus;
  
  // Document data
  documentS3Key: string;
  pageCount: number;
  
  // Extracted answers
  extractedAnswers?: ExtractedAnswers;
  extractionConfidence?: number;
  
  // Grading results
  gradingDecisions?: GradingDecision[];
  totalScore?: number;
  maxScore?: number;
  averageConfidence?: number;
  gradedAt?: string;
  
  // Manual overrides
  manualOverrides: ManualGradeOverride[];
  isFinalized: boolean;
  finalizedAt?: string;
  finalizedBy?: string;
  
  // Cost tracking
  costTracking?: CostTracking;
  
  // GSI attributes
  GSI1PK: string; // "CUSTOMER#{customerId}"
  GSI1SK: string; // "SUBMISSION#{submittedAt}"
  
  GSI2PK: string; // "STUDENT#{studentId}"
  GSI2SK: string; // "SUBMISSION#{submittedAt}"
}

// ========================================
// Export Service Types
// ========================================

export interface ExportResult {
  exportId: string;
  downloadUrl: string;
  expiresAt: string; // ISO 8601
  format: 'CSV' | 'EXCEL';
  recordCount: number;
}

// ========================================
// Component Interface Types
// ========================================

export interface DocumentProcessor {
  extractQuestionsFromQuestionnaire(
    documentUrl: string,
    customerId: string
  ): Promise<ExtractedQuestionnaire>;
  
  extractAnswerKeyMappings(
    documentUrl: string,
    customerId: string
  ): Promise<AnswerKeyMapping[]>;
  
  validateDocumentFormat(
    fileBuffer: Buffer,
    expectedFormat: DocumentFormat
  ): boolean;
}

export interface HandwritingRecognizer {
  extractHandwrittenAnswers(
    documentUrl: string,
    examStructure: ExtractedQuestionnaire,
    customerId: string
  ): Promise<ExtractedAnswers>;
  
  getExtractionConfidence(
    textractResponse: any
  ): number;
}

export interface AIGradingEngine {
  gradeAnswer(
    studentAnswer: string,
    expectedAnswer: string,
    questionContext: QuestionContext,
    customerId: string
  ): Promise<GradingDecision>;
  
  batchGradeSubmission(
    submission: ExtractedAnswers,
    answerKey: AnswerKeyMapping[],
    examContext: ExamContext,
    customerId: string
  ): Promise<GradingResult>;
}

export interface ExamManagementService {
  createExam(
    examData: CreateExamRequest,
    customerId: string
  ): Promise<Exam>;
  
  getExam(
    examId: string,
    customerId: string
  ): Promise<Exam>;
  
  listExams(
    customerId: string,
    filters?: ExamFilters
  ): Promise<Exam[]>;
  
  updateExamQuestions(
    examId: string,
    questions: Question[],
    customerId: string
  ): Promise<void>;
  
  deleteExam(
    examId: string,
    customerId: string
  ): Promise<void>;
}

export interface SubmissionManagementService {
  createSubmission(
    submissionData: CreateSubmissionRequest,
    customerId: string
  ): Promise<Submission>;
  
  getSubmission(
    submissionId: string,
    customerId: string
  ): Promise<Submission>;
  
  listSubmissions(
    examId: string,
    customerId: string
  ): Promise<Submission[]>;
  
  updateGrade(
    submissionId: string,
    questionNumber: string,
    manualGrade: ManualGradeOverride,
    customerId: string
  ): Promise<void>;
  
  finalizeSubmission(
    submissionId: string,
    customerId: string
  ): Promise<void>;
}

export interface ExportService {
  exportToCSV(
    examId: string,
    customerId: string
  ): Promise<ExportResult>;
  
  exportToExcel(
    examId: string,
    customerId: string
  ): Promise<ExportResult>;
}

// ========================================
// Batch Processing Types
// ========================================

export interface BatchSubmissionRequest {
  examId: string;
  submissions: BatchSubmissionItem[];
}

export interface BatchSubmissionItem {
  studentId: string;
  studentName: string;
  documentUrl: string;
}

export interface BatchProcessingStatus {
  batchId: string;
  examId: string;
  customerId: string;
  totalSubmissions: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  submissions: BatchSubmissionProgress[];
}

export interface BatchSubmissionProgress {
  submissionId: string;
  studentId: string;
  studentName: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string;
  processedAt?: string;
}

export interface BatchProcessingRecord {
  // Partition Key
  PK: string; // "CUSTOMER#{customerId}"
  
  // Sort Key
  SK: string; // "BATCH#{batchId}"
  
  // Attributes
  batchId: string;
  examId: string;
  customerId: string;
  totalSubmissions: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  submissions: BatchSubmissionProgress[];
  
  // GSI attributes
  GSI1PK: string; // "EXAM#{examId}"
  GSI1SK: string; // "BATCH#{createdAt}"
}

export interface SQSSubmissionMessage {
  submissionId: string;
  batchId: string;
  examId: string;
  customerId: string;
  studentId: string;
  studentName: string;
  documentUrl: string;
}
