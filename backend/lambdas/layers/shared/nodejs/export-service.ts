/**
 * ExportService
 * 
 * Generates CSV and Excel exports of grading results for an exam.
 * Includes student information, per-question marks, confidence scores,
 * AI explanations, and manual overrides.
 * 
 * Export files are uploaded to S3 with pre-signed URLs that expire in 1 hour.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import {
  ExportService as IExportService,
  ExportResult,
  SubmissionRecord,
  GradingDecision,
  ManualGradeOverride
} from './exam-types';

const TABLE_NAME = process.env.EXAMS_TABLE_NAME || 'ExamGradingSystem';
const BUCKET_NAME = process.env.EXPORTS_BUCKET_NAME || 'exam-grading-exports';
const URL_EXPIRATION_SECONDS = 3600; // 1 hour

interface ExportRow {
  studentId: string;
  studentName: string;
  questionNumber: string;
  marksAwarded: number;
  maxMarks: number;
  confidence: number;
  aiExplanation: string;
  manualOverride: string;
  reviewedBy: string;
  totalScore: number;
}

export class ExportService implements IExportService {
  private docClient: DynamoDBDocumentClient;
  private s3Client: S3Client;
  
  constructor() {
    const dynamoClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.s3Client = new S3Client({});
  }
  
  /**
   * Exports grading results to CSV format
   * 
   * @param examId - Exam identifier
   * @param customerId - Customer identifier for multi-tenant isolation
   * @returns Export result with download URL
   */
  async exportToCSV(
    examId: string,
    customerId: string
  ): Promise<ExportResult> {
    // Fetch all submissions for the exam
    const submissions = await this.fetchSubmissions(examId, customerId);
    
    // Transform submissions into export rows
    const rows = this.transformSubmissionsToRows(submissions);
    
    // Generate CSV content
    const csvContent = stringify(rows, {
      header: true,
      columns: [
        { key: 'studentId', header: 'Student ID' },
        { key: 'studentName', header: 'Student Name' },
        { key: 'questionNumber', header: 'Question Number' },
        { key: 'marksAwarded', header: 'Marks Awarded' },
        { key: 'maxMarks', header: 'Max Marks' },
        { key: 'confidence', header: 'Confidence (%)' },
        { key: 'aiExplanation', header: 'AI Explanation' },
        { key: 'manualOverride', header: 'Manual Override' },
        { key: 'reviewedBy', header: 'Reviewed By' },
        { key: 'totalScore', header: 'Total Score' }
      ]
    });
    
    // Upload to S3 and generate pre-signed URL
    const exportId = uuidv4();
    const s3Key = `${customerId}/exports/${exportId}.csv`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: csvContent,
      ContentType: 'text/csv'
    }));
    
    const downloadUrl = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      }),
      { expiresIn: URL_EXPIRATION_SECONDS }
    );
    
    const expiresAt = new Date(Date.now() + URL_EXPIRATION_SECONDS * 1000).toISOString();
    
    return {
      exportId,
      downloadUrl,
      expiresAt,
      format: 'CSV',
      recordCount: rows.length
    };
  }
  
  /**
   * Exports grading results to Excel format
   * 
   * @param examId - Exam identifier
   * @param customerId - Customer identifier for multi-tenant isolation
   * @returns Export result with download URL
   */
  async exportToExcel(
    examId: string,
    customerId: string
  ): Promise<ExportResult> {
    // Fetch all submissions for the exam
    const submissions = await this.fetchSubmissions(examId, customerId);
    
    // Transform submissions into export rows
    const rows = this.transformSubmissionsToRows(submissions);
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Grading Results');
    
    // Define columns
    worksheet.columns = [
      { header: 'Student ID', key: 'studentId', width: 15 },
      { header: 'Student Name', key: 'studentName', width: 20 },
      { header: 'Question Number', key: 'questionNumber', width: 15 },
      { header: 'Marks Awarded', key: 'marksAwarded', width: 15 },
      { header: 'Max Marks', key: 'maxMarks', width: 12 },
      { header: 'Confidence (%)', key: 'confidence', width: 15 },
      { header: 'AI Explanation', key: 'aiExplanation', width: 40 },
      { header: 'Manual Override', key: 'manualOverride', width: 15 },
      { header: 'Reviewed By', key: 'reviewedBy', width: 20 },
      { header: 'Total Score', key: 'totalScore', width: 12 }
    ];
    
    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data rows
    rows.forEach(row => {
      worksheet.addRow(row);
    });
    
    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Upload to S3 and generate pre-signed URL
    const exportId = uuidv4();
    const s3Key = `${customerId}/exports/${exportId}.xlsx`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    
    const downloadUrl = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      }),
      { expiresIn: URL_EXPIRATION_SECONDS }
    );
    
    const expiresAt = new Date(Date.now() + URL_EXPIRATION_SECONDS * 1000).toISOString();
    
    return {
      exportId,
      downloadUrl,
      expiresAt,
      format: 'EXCEL',
      recordCount: rows.length
    };
  }
  
  /**
   * Fetches all submissions for an exam from DynamoDB
   * 
   * @param examId - Exam identifier
   * @param customerId - Customer identifier for validation
   * @returns Array of submission records
   */
  private async fetchSubmissions(
    examId: string,
    customerId: string
  ): Promise<SubmissionRecord[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `EXAM#${examId}`,
        ':sk': 'SUBMISSION#'
      }
    }));
    
    const submissions = (result.Items || []) as SubmissionRecord[];
    
    // Validate all submissions belong to the customer
    submissions.forEach(submission => {
      if (submission.customerId !== customerId) {
        throw new Error(`Access denied: Submission ${submission.submissionId} does not belong to customer ${customerId}`);
      }
    });
    
    return submissions;
  }
  
  /**
   * Transforms submission records into export rows
   * 
   * @param submissions - Array of submission records
   * @returns Array of export rows
   */
  private transformSubmissionsToRows(submissions: SubmissionRecord[]): ExportRow[] {
    const rows: ExportRow[] = [];
    
    for (const submission of submissions) {
      // Skip submissions that haven't been graded yet
      if (!submission.gradingDecisions || submission.gradingDecisions.length === 0) {
        continue;
      }
      
      const totalScore = submission.totalScore || 0;
      
      for (const decision of submission.gradingDecisions) {
        // Find manual override for this question if it exists
        const override = submission.manualOverrides.find(
          o => o.questionNumber === decision.questionNumber
        );
        
        rows.push({
          studentId: submission.studentId,
          studentName: submission.studentName,
          questionNumber: decision.questionNumber,
          marksAwarded: override ? override.overriddenMarks : decision.marksAwarded,
          maxMarks: decision.maxMarks,
          confidence: Math.round(decision.confidence * 100) / 100, // Round to 2 decimal places
          aiExplanation: decision.explanation,
          manualOverride: override ? 'Yes' : 'No',
          reviewedBy: override ? override.reviewedBy : '',
          totalScore
        });
      }
    }
    
    return rows;
  }
}
