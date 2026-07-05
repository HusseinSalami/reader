/**
 * Unit tests for CostTrackingService
 * 
 * Tests cover:
 * - Textract usage recording and cost calculation
 * - Bedrock usage recording and cost calculation
 * - Cost aggregation per customer
 * - Cost threshold checking and notifications
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  QueryCommand: vi.fn((input) => ({ input })),
  UpdateCommand: vi.fn((input) => ({ input }))
}));

// Import service AFTER mocks are set up
import { CostTrackingService, TextractUsage, BedrockUsage } from './cost-tracking-service';

describe('CostTrackingService', () => {
  let service: CostTrackingService;
  
  beforeEach(() => {
    mockSend.mockReset();
    service = new CostTrackingService();
  });
  
  describe('recordTextractUsage', () => {
    it('should record Textract usage and return calculated cost', () => {
      const usage: TextractUsage = {
        customerId: 'customer-123',
        examId: 'exam-456',
        submissionId: 'submission-789',
        pageCount: 10,
        timestamp: new Date().toISOString()
      };
      
      const cost = service.recordTextractUsage(usage);
      
      // $1.50 per 1000 pages = $0.0015 per page
      // 10 pages * $0.0015 = $0.015
      expect(cost).toBe(0.015);
    });
    
    it('should handle zero pages', () => {
      const usage: TextractUsage = {
        customerId: 'customer-123',
        examId: 'exam-456',
        pageCount: 0,
        timestamp: new Date().toISOString()
      };
      
      const cost = service.recordTextractUsage(usage);
      expect(cost).toBe(0);
    });
    
    it('should handle large page counts', () => {
      const usage: TextractUsage = {
        customerId: 'customer-123',
        examId: 'exam-456',
        pageCount: 1000,
        timestamp: new Date().toISOString()
      };
      
      const cost = service.recordTextractUsage(usage);
      
      // 1000 pages * $0.0015 = $1.50
      expect(cost).toBe(1.5);
    });
  });
  
  describe('recordBedrockUsage', () => {
    it('should record Bedrock usage and return calculated cost', () => {
      const usage: BedrockUsage = {
        customerId: 'customer-123',
        examId: 'exam-456',
        submissionId: 'submission-789',
        inputTokens: 1000,
        outputTokens: 500,
        timestamp: new Date().toISOString()
      };
      
      const cost = service.recordBedrockUsage(usage);
      
      // Input: 1000 tokens * $0.00025/1000 = $0.00025
      // Output: 500 tokens * $0.00125/1000 = $0.000625
      // Total: $0.000875
      expect(cost).toBeCloseTo(0.000875, 6);
    });
    
    it('should handle zero tokens', () => {
      const usage: BedrockUsage = {
        customerId: 'customer-123',
        examId: 'exam-456',
        inputTokens: 0,
        outputTokens: 0,
        timestamp: new Date().toISOString()
      };
      
      const cost = service.recordBedrockUsage(usage);
      expect(cost).toBe(0);
    });
    
    it('should handle large token counts', () => {
      const usage: BedrockUsage = {
        customerId: 'customer-123',
        examId: 'exam-456',
        inputTokens: 100000,
        outputTokens: 50000,
        timestamp: new Date().toISOString()
      };
      
      const cost = service.recordBedrockUsage(usage);
      
      // Input: 100000 * $0.00025/1000 = $0.025
      // Output: 50000 * $0.00125/1000 = $0.0625
      // Total: $0.0875
      expect(cost).toBeCloseTo(0.0875, 6);
    });
  });
  
  describe('calculateTextractCost', () => {
    it('should calculate cost correctly for various page counts', () => {
      expect(service.calculateTextractCost(1)).toBe(0.0015);
      expect(service.calculateTextractCost(10)).toBe(0.015);
      expect(service.calculateTextractCost(100)).toBe(0.15);
      expect(service.calculateTextractCost(1000)).toBe(1.5);
    });
    
    it('should return 0 for 0 pages', () => {
      expect(service.calculateTextractCost(0)).toBe(0);
    });
    
    it('should throw error for negative page count', () => {
      expect(() => service.calculateTextractCost(-1)).toThrow('Page count cannot be negative');
    });
  });
  
  describe('calculateBedrockCost', () => {
    it('should calculate cost correctly for various token counts', () => {
      // 1000 input, 500 output
      const cost1 = service.calculateBedrockCost(1000, 500);
      expect(cost1).toBeCloseTo(0.000875, 6);
      
      // 10000 input, 5000 output
      const cost2 = service.calculateBedrockCost(10000, 5000);
      expect(cost2).toBeCloseTo(0.00875, 6);
      
      // 100000 input, 50000 output
      const cost3 = service.calculateBedrockCost(100000, 50000);
      expect(cost3).toBeCloseTo(0.0875, 6);
    });
    
    it('should return 0 for 0 tokens', () => {
      expect(service.calculateBedrockCost(0, 0)).toBe(0);
    });
    
    it('should handle only input tokens', () => {
      const cost = service.calculateBedrockCost(1000, 0);
      expect(cost).toBeCloseTo(0.00025, 6);
    });
    
    it('should handle only output tokens', () => {
      const cost = service.calculateBedrockCost(0, 1000);
      expect(cost).toBeCloseTo(0.00125, 6);
    });
    
    it('should throw error for negative input tokens', () => {
      expect(() => service.calculateBedrockCost(-1, 100)).toThrow('Token counts cannot be negative');
    });
    
    it('should throw error for negative output tokens', () => {
      expect(() => service.calculateBedrockCost(100, -1)).toThrow('Token counts cannot be negative');
    });
  });
  
  describe('aggregateCostsByCustomer', () => {
    it('should aggregate costs across multiple exams and submissions', async () => {
      // Mock exam query
      mockSend.mockResolvedValueOnce({
        Items: [
          { examId: 'exam-1', totalCost: 0 },
          { examId: 'exam-2', totalCost: 0 }
        ]
      });
      
      // Mock submissions for exam-1
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            submissionId: 'sub-1',
            costTracking: {
              textractPages: 10,
              textractCost: 0.015,
              bedrockTokensInput: 1000,
              bedrockTokensOutput: 500,
              bedrockCost: 0.000875,
              totalCost: 0.015875
            }
          },
          {
            submissionId: 'sub-2',
            costTracking: {
              textractPages: 5,
              textractCost: 0.0075,
              bedrockTokensInput: 500,
              bedrockTokensOutput: 250,
              bedrockCost: 0.0004375,
              totalCost: 0.0079375
            }
          }
        ]
      });
      
      // Mock submissions for exam-2
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            submissionId: 'sub-3',
            costTracking: {
              textractPages: 8,
              textractCost: 0.012,
              bedrockTokensInput: 800,
              bedrockTokensOutput: 400,
              bedrockCost: 0.0007,
              totalCost: 0.0127
            }
          }
        ]
      });
      
      const summary = await service.aggregateCostsByCustomer('customer-123');
      
      expect(summary.customerId).toBe('customer-123');
      expect(summary.examCount).toBe(2);
      expect(summary.submissionCount).toBe(3);
      expect(summary.totalTextractCost).toBeCloseTo(0.0345, 4);
      expect(summary.totalBedrockCost).toBeCloseTo(0.0020125, 6);
      expect(summary.totalCost).toBeCloseTo(0.0365125, 6);
    });
    
    it('should handle customer with no exams', async () => {
      mockSend.mockResolvedValue({
        Items: []
      });
      
      const summary = await service.aggregateCostsByCustomer('customer-empty');
      
      expect(summary.customerId).toBe('customer-empty');
      expect(summary.examCount).toBe(0);
      expect(summary.submissionCount).toBe(0);
      expect(summary.totalTextractCost).toBe(0);
      expect(summary.totalBedrockCost).toBe(0);
      expect(summary.totalCost).toBe(0);
    });
    
    it('should handle exams with no submissions', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { examId: 'exam-1', totalCost: 0 }
        ]
      }).mockResolvedValueOnce({
        Items: []
      });
      
      const summary = await service.aggregateCostsByCustomer('customer-123');
      
      expect(summary.examCount).toBe(1);
      expect(summary.submissionCount).toBe(0);
      expect(summary.totalCost).toBe(0);
    });
    
    it('should handle submissions without cost tracking', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { examId: 'exam-1', totalCost: 0 }
        ]
      }).mockResolvedValueOnce({
        Items: [
          { submissionId: 'sub-1' }, // No costTracking field
          { submissionId: 'sub-2', costTracking: null }
        ]
      });
      
      const summary = await service.aggregateCostsByCustomer('customer-123');
      
      expect(summary.submissionCount).toBe(2);
      expect(summary.totalCost).toBe(0);
    });
  });
  
  describe('checkCostThreshold', () => {
    it('should return exceeded=true when cost exceeds threshold', async () => {
      // Mock aggregation to return total cost of $10
      mockSend.mockResolvedValueOnce({
        Items: [{ examId: 'exam-1' }]
      }).mockResolvedValueOnce({
        Items: [
          {
            submissionId: 'sub-1',
            costTracking: {
              textractCost: 5,
              bedrockCost: 5,
              totalCost: 10
            }
          }
        ]
      });
      
      const result = await service.checkCostThreshold('customer-123', 5);
      
      expect(result.exceeded).toBe(true);
      expect(result.currentCost).toBe(10);
      expect(result.threshold).toBe(5);
    });
    
    it('should return exceeded=false when cost is below threshold', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ examId: 'exam-1' }]
      }).mockResolvedValueOnce({
        Items: [
          {
            submissionId: 'sub-1',
            costTracking: {
              textractCost: 2,
              bedrockCost: 1,
              totalCost: 3
            }
          }
        ]
      });
      
      const result = await service.checkCostThreshold('customer-123', 10);
      
      expect(result.exceeded).toBe(false);
      expect(result.currentCost).toBe(3);
      expect(result.threshold).toBe(10);
    });
    
    it('should return exceeded=false when cost equals threshold', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ examId: 'exam-1' }]
      }).mockResolvedValueOnce({
        Items: [
          {
            submissionId: 'sub-1',
            costTracking: {
              textractCost: 3,
              bedrockCost: 2,
              totalCost: 5
            }
          }
        ]
      });
      
      const result = await service.checkCostThreshold('customer-123', 5);
      
      expect(result.exceeded).toBe(false);
      expect(result.currentCost).toBe(5);
      expect(result.threshold).toBe(5);
    });
    
    it('should throw error for negative threshold', async () => {
      await expect(service.checkCostThreshold('customer-123', -1))
        .rejects.toThrow('Threshold cannot be negative');
    });
    
    it('should handle zero threshold', async () => {
      mockSend.mockResolvedValueOnce({
        Items: []
      });
      
      const result = await service.checkCostThreshold('customer-123', 0);
      
      expect(result.exceeded).toBe(false);
      expect(result.threshold).toBe(0);
    });
  });
  
  describe('updateExamCost', () => {
    it('should update exam total cost in DynamoDB', async () => {
      mockSend.mockResolvedValue({});
      
      await service.updateExamCost('exam-123', 'customer-456', 5.50);
      
      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.input).toMatchObject({
        Key: {
          PK: 'CUSTOMER#customer-456',
          SK: 'EXAM#exam-123'
        },
        UpdateExpression: expect.stringContaining('totalCost')
      });
    });
  });
  
  describe('createCostTracking', () => {
    it('should create complete cost tracking object', () => {
      const tracking = service.createCostTracking(10, 1000, 500);
      
      expect(tracking.textractPages).toBe(10);
      expect(tracking.textractCost).toBe(0.015);
      expect(tracking.bedrockTokensInput).toBe(1000);
      expect(tracking.bedrockTokensOutput).toBe(500);
      expect(tracking.bedrockCost).toBeCloseTo(0.000875, 6);
      expect(tracking.totalCost).toBeCloseTo(0.015875, 6);
    });
    
    it('should handle zero usage', () => {
      const tracking = service.createCostTracking(0, 0, 0);
      
      expect(tracking.textractPages).toBe(0);
      expect(tracking.textractCost).toBe(0);
      expect(tracking.bedrockTokensInput).toBe(0);
      expect(tracking.bedrockTokensOutput).toBe(0);
      expect(tracking.bedrockCost).toBe(0);
      expect(tracking.totalCost).toBe(0);
    });
    
    it('should calculate total cost correctly', () => {
      const tracking = service.createCostTracking(100, 10000, 5000);
      
      // Textract: 100 * 0.0015 = 0.15
      // Bedrock: (10000 * 0.00025/1000) + (5000 * 0.00125/1000) = 0.0025 + 0.00625 = 0.00875
      // Total: 0.15875
      expect(tracking.totalCost).toBeCloseTo(0.15875, 5);
    });
  });
  
  describe('Edge cases and integration', () => {
    it('should handle fractional page counts', () => {
      const cost = service.calculateTextractCost(1.5);
      expect(cost).toBeCloseTo(0.00225, 6);
    });
    
    it('should handle very small token counts', () => {
      const cost = service.calculateBedrockCost(1, 1);
      expect(cost).toBeCloseTo(0.00000025 + 0.00000125, 10);
    });
    
    it('should maintain precision for large calculations', () => {
      const tracking = service.createCostTracking(10000, 1000000, 500000);
      
      // Textract: 10000 * 0.0015 = 15
      // Bedrock: (1000000 * 0.00025/1000) + (500000 * 0.00125/1000) = 0.25 + 0.625 = 0.875
      // Total: 15.875
      expect(tracking.totalCost).toBeCloseTo(15.875, 3);
    });
  });
});
