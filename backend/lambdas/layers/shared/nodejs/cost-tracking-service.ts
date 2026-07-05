/**
 * CostTrackingService
 * 
 * Tracks and calculates costs for AWS services used in the exam grading system:
 * - AWS Textract: Document processing costs based on page counts
 * - Amazon Bedrock: AI grading costs based on token usage
 * 
 * Provides cost aggregation per customer and threshold notifications.
 * 
 * AWS Pricing (approximate):
 * - Textract: $1.50 per 1000 pages
 * - Bedrock Claude Haiku: $0.00025 per 1K input tokens, $0.00125 per 1K output tokens
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  QueryCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { CostTracking } from './exam-types';

const TABLE_NAME = process.env.EXAMS_TABLE_NAME || 'ExamGradingSystem';

// AWS Pricing constants (approximate)
const TEXTRACT_COST_PER_PAGE = 0.0015; // $1.50 per 1000 pages
const BEDROCK_INPUT_TOKEN_COST = 0.00025 / 1000; // $0.00025 per 1K tokens
const BEDROCK_OUTPUT_TOKEN_COST = 0.00125 / 1000; // $0.00125 per 1K tokens

export interface UsageRecord {
  customerId: string;
  examId: string;
  submissionId?: string;
  timestamp: string;
}

export interface TextractUsage extends UsageRecord {
  pageCount: number;
}

export interface BedrockUsage extends UsageRecord {
  inputTokens: number;
  outputTokens: number;
}

export interface CustomerCostSummary {
  customerId: string;
  totalTextractCost: number;
  totalBedrockCost: number;
  totalCost: number;
  examCount: number;
  submissionCount: number;
}

export class CostTrackingService {
  private docClient: DynamoDBDocumentClient;
  
  constructor() {
    const dynamoClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
  }
  
  /**
   * Records Textract usage for a document processing operation
   * 
   * @param usage - Textract usage details including page count
   * @returns Calculated cost for this usage
   */
  recordTextractUsage(usage: TextractUsage): number {
    const cost = this.calculateTextractCost(usage.pageCount);
    
    // Log usage for monitoring and auditing
    console.log('Textract usage recorded:', {
      customerId: usage.customerId,
      examId: usage.examId,
      submissionId: usage.submissionId,
      pageCount: usage.pageCount,
      cost,
      timestamp: usage.timestamp
    });
    
    return cost;
  }
  
  /**
   * Records Bedrock usage for an AI grading operation
   * 
   * @param usage - Bedrock usage details including token counts
   * @returns Calculated cost for this usage
   */
  recordBedrockUsage(usage: BedrockUsage): number {
    const cost = this.calculateBedrockCost(usage.inputTokens, usage.outputTokens);
    
    // Log usage for monitoring and auditing
    console.log('Bedrock usage recorded:', {
      customerId: usage.customerId,
      examId: usage.examId,
      submissionId: usage.submissionId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cost,
      timestamp: usage.timestamp
    });
    
    return cost;
  }
  
  /**
   * Calculates Textract cost based on page count
   * 
   * @param pageCount - Number of pages processed
   * @returns Cost in USD
   */
  calculateTextractCost(pageCount: number): number {
    if (pageCount < 0) {
      throw new Error('Page count cannot be negative');
    }
    
    return pageCount * TEXTRACT_COST_PER_PAGE;
  }
  
  /**
   * Calculates Bedrock cost based on token usage
   * 
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @returns Cost in USD
   */
  calculateBedrockCost(inputTokens: number, outputTokens: number): number {
    if (inputTokens < 0 || outputTokens < 0) {
      throw new Error('Token counts cannot be negative');
    }
    
    const inputCost = inputTokens * BEDROCK_INPUT_TOKEN_COST;
    const outputCost = outputTokens * BEDROCK_OUTPUT_TOKEN_COST;
    
    return inputCost + outputCost;
  }
  
  /**
   * Aggregates costs for a specific customer across all their exams
   * 
   * @param customerId - Customer identifier
   * @returns Cumulative cost summary for the customer
   */
  async aggregateCostsByCustomer(customerId: string): Promise<CustomerCostSummary> {
    // Query all exams for this customer
    const response = await this.docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `CUSTOMER#${customerId}`,
        ':sk': 'EXAM#'
      }
    }));
    
    const exams = response.Items || [];
    
    let totalTextractCost = 0;
    let totalBedrockCost = 0;
    let submissionCount = 0;
    
    // Aggregate costs from all exams
    for (const exam of exams) {
      // Query all submissions for this exam
      const submissionsResponse = await this.docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `EXAM#${exam.examId}`,
          ':sk': 'SUBMISSION#'
        }
      }));
      
      const submissions = submissionsResponse.Items || [];
      submissionCount += submissions.length;
      
      // Sum up costs from all submissions
      for (const submission of submissions) {
        if (submission.costTracking) {
          totalTextractCost += submission.costTracking.textractCost || 0;
          totalBedrockCost += submission.costTracking.bedrockCost || 0;
        }
      }
    }
    
    return {
      customerId,
      totalTextractCost,
      totalBedrockCost,
      totalCost: totalTextractCost + totalBedrockCost,
      examCount: exams.length,
      submissionCount
    };
  }
  
  /**
   * Checks if customer costs exceed a configured threshold and returns notification status
   * 
   * @param customerId - Customer identifier
   * @param threshold - Cost threshold in USD
   * @returns Object indicating if threshold is exceeded and current cost
   */
  async checkCostThreshold(
    customerId: string, 
    threshold: number
  ): Promise<{ exceeded: boolean; currentCost: number; threshold: number }> {
    if (threshold < 0) {
      throw new Error('Threshold cannot be negative');
    }
    
    const costSummary = await this.aggregateCostsByCustomer(customerId);
    const exceeded = costSummary.totalCost > threshold;
    
    if (exceeded) {
      console.warn('Cost threshold exceeded:', {
        customerId,
        currentCost: costSummary.totalCost,
        threshold,
        exceedBy: costSummary.totalCost - threshold
      });
      
      // In a production system, this would trigger an SNS notification
      // For now, we log the warning
    }
    
    return {
      exceeded,
      currentCost: costSummary.totalCost,
      threshold
    };
  }
  
  /**
   * Updates the total cost for an exam in DynamoDB
   * 
   * @param examId - Exam identifier
   * @param customerId - Customer identifier
   * @param additionalCost - Cost to add to the exam's total
   */
  async updateExamCost(
    examId: string,
    customerId: string,
    additionalCost: number
  ): Promise<void> {
    await this.docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CUSTOMER#${customerId}`,
        SK: `EXAM#${examId}`
      },
      UpdateExpression: 'SET totalCost = if_not_exists(totalCost, :zero) + :cost, updatedAt = :now',
      ExpressionAttributeValues: {
        ':cost': additionalCost,
        ':zero': 0,
        ':now': new Date().toISOString()
      }
    }));
  }
  
  /**
   * Creates a complete cost tracking record for a submission
   * 
   * @param textractPages - Number of pages processed by Textract
   * @param bedrockInputTokens - Number of input tokens used by Bedrock
   * @param bedrockOutputTokens - Number of output tokens used by Bedrock
   * @returns Complete cost tracking object
   */
  createCostTracking(
    textractPages: number,
    bedrockInputTokens: number,
    bedrockOutputTokens: number
  ): CostTracking {
    const textractCost = this.calculateTextractCost(textractPages);
    const bedrockCost = this.calculateBedrockCost(bedrockInputTokens, bedrockOutputTokens);
    
    return {
      textractPages,
      textractCost,
      bedrockTokensInput: bedrockInputTokens,
      bedrockTokensOutput: bedrockOutputTokens,
      bedrockCost,
      totalCost: textractCost + bedrockCost
    };
  }
}
