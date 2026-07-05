/**
 * Export to Excel Handler
 * 
 * GET /exams/:examId/export/excel
 * 
 * Generates an Excel export of all grading results for an exam and returns
 * a pre-signed S3 URL for download.
 * 
 * Requirements: 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ExportService } from '../layers/shared/nodejs/export-service';
import { ExamManagementService } from '../layers/shared/nodejs/exam-management-service';

const exportService = new ExportService();
const examService = new ExamManagementService();

/**
 * Lambda handler for Excel export
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    
    if (!customerId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Unauthorized: Missing customer ID' })
      };
    }
    
    // Extract examId from path parameters
    const examId = event.pathParameters?.examId;
    if (!examId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing examId in path' })
      };
    }
    
    // Verify exam exists and belongs to customer (multi-tenant isolation)
    try {
      await examService.getExam(examId, customerId);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: `Exam ${examId} not found` })
        };
      }
      throw error;
    }
    
    // Generate Excel export
    const exportResult = await exportService.exportToExcel(examId, customerId);
    
    console.log(`Generated Excel export ${exportResult.exportId} for exam ${examId} with ${exportResult.recordCount} records`);
    
    // Return export result with pre-signed URL
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Excel export generated successfully',
        export: exportResult
      })
    };
    
  } catch (error) {
    console.error('Error generating Excel export:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to generate Excel export',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
