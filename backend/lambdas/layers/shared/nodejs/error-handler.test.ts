/**
 * Unit tests for error-handler module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  classifyError,
  logError,
  withRetry,
  withAWSRetry,
  createErrorResponse,
  preservePartialSuccess,
  processBatchWithErrorHandling,
  ErrorType,
  ErrorContext,
} from './error-handler';

describe('Error Handler', () => {
  describe('classifyError', () => {
    it('should classify throttling errors', () => {
      const error = new Error('Request limit exceeded - throttling');
      const classified = classifyError(error);
      
      expect(classified.type).toBe(ErrorType.THROTTLING);
      expect(classified.shouldRetry).toBe(true);
      expect(classified.userMessage).toContain('rate limit');
    });
    
    it('should classify access denied errors', () => {
      const error = new Error('Access denied to resource');
      const classified = classifyError(error);
      
      expect(classified.type).toBe(ErrorType.ACCESS_DENIED);
      expect(classified.shouldRetry).toBe(false);
      expect(classified.userMessage).toContain('Access denied');
    });
    
    it('should classify not found errors', () => {
      const error = new Error('Resource not found');
      const classified = classifyError(error);
      
      expect(classified.type).toBe(ErrorType.NOT_FOUND);
      expect(classified.shouldRetry).toBe(false);
      expect(classified.userMessage).toContain('not found');
    });
    
    it('should classify invalid input errors', () => {
      const error = new Error('Invalid document format');
      const classified = classifyError(error);
      
      expect(classified.type).toBe(ErrorType.INVALID_INPUT);
      expect(classified.shouldRetry).toBe(false);
      expect(classified.userMessage).toContain('Invalid input');
    });
    
    it('should classify service unavailable errors', () => {
      const error = new Error('Service unavailable - 503');
      const classified = classifyError(error);
      
      expect(classified.type).toBe(ErrorType.SERVICE_UNAVAILABLE);
      expect(classified.shouldRetry).toBe(true);
      expect(classified.userMessage).toContain('temporarily unavailable');
    });
    
    it('should classify timeout errors', () => {
      const error = new Error('Operation timed out');
      const classified = classifyError(error);
      
      expect(classified.type).toBe(ErrorType.TIMEOUT);
      expect(classified.shouldRetry).toBe(true);
      expect(classified.userMessage).toContain('timed out');
    });
    
    it('should classify extraction errors', () => {
      const error = new Error('No content extracted from document');
      const classified = classifyError(error);
      
      expect(classified.type).toBe(ErrorType.EXTRACTION_ERROR);
      expect(classified.shouldRetry).toBe(false);
    });
    
    it('should classify grading errors', () => {
      const error = new Error('Bedrock grading failed');
      const classified = classifyError(error);
      
      expect(classified.type).toBe(ErrorType.GRADING_ERROR);
      expect(classified.shouldRetry).toBe(true);
      expect(classified.userMessage).toContain('manual review');
    });
    
    it('should classify unknown errors', () => {
      const error = new Error('Something weird happened');
      const classified = classifyError(error);
      
      expect(classified.type).toBe(ErrorType.UNKNOWN);
      expect(classified.shouldRetry).toBe(false);
      expect(classified.userMessage).toContain('unexpected error');
    });
    
    it('should include context in classified error', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        operation: 'test-operation',
        customerId: 'customer-123',
        examId: 'exam-456',
      };
      
      const classified = classifyError(error, context);
      
      expect(classified.context).toEqual(context);
    });
  });
  
  describe('logError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    
    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });
    
    it('should log error with context', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        operation: 'test-operation',
        customerId: 'customer-123',
      };
      
      logError(error, context);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][1]);
      
      expect(loggedData.errorMessage).toBe('Test error');
      expect(loggedData.context).toEqual(context);
      expect(loggedData.timestamp).toBeDefined();
    });
    
    it('should log classified error', () => {
      const error = new Error('Throttling error');
      const classified = classifyError(error);
      
      logError(classified);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][1]);
      
      expect(loggedData.errorType).toBe(ErrorType.THROTTLING);
      expect(loggedData.shouldRetry).toBe(true);
    });
  });
  
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const context: ErrorContext = { operation: 'test' };
      
      const result = await withRetry(operation, context);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
    
    it('should retry on retryable error', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce('success');
      
      const context: ErrorContext = { operation: 'test' };
      
      const result = await withRetry(operation, context, {
        maxRetries: 2,
        initialDelayMs: 10,
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
    
    it('should not retry on non-retryable error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Access denied'));
      const context: ErrorContext = { operation: 'test' };
      
      await expect(
        withRetry(operation, context, { maxRetries: 3, initialDelayMs: 10 })
      ).rejects.toThrow();
      
      expect(operation).toHaveBeenCalledTimes(1);
    });
    
    it('should throw after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Service unavailable'));
      const context: ErrorContext = { operation: 'test' };
      
      await expect(
        withRetry(operation, context, { maxRetries: 2, initialDelayMs: 10 })
      ).rejects.toThrow();
      
      expect(operation).toHaveBeenCalledTimes(2);
    });
    
    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const startTime = Date.now();
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce('success');
      
      const context: ErrorContext = { operation: 'test' };
      
      await withRetry(operation, context, {
        maxRetries: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      });
      
      const totalTime = Date.now() - startTime;
      
      // Should have waited at least 100ms + 200ms = 300ms
      expect(totalTime).toBeGreaterThanOrEqual(300);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('withAWSRetry', () => {
    it('should wrap AWS SDK call with retry logic', async () => {
      const sdkCall = vi.fn().mockResolvedValue({ data: 'test' });
      const context: ErrorContext = { operation: 'test' };
      
      const result = await withAWSRetry(sdkCall, 'DynamoDB', context);
      
      expect(result).toEqual({ data: 'test' });
      expect(sdkCall).toHaveBeenCalledTimes(1);
    });
    
    it('should retry AWS SDK call on throttling', async () => {
      const sdkCall = vi.fn()
        .mockRejectedValueOnce(new Error('ThrottlingException'))
        .mockResolvedValueOnce({ data: 'test' });
      
      const context: ErrorContext = { operation: 'test' };
      
      const result = await withAWSRetry(sdkCall, 'DynamoDB', context, {
        maxRetries: 2,
        initialDelayMs: 10,
      });
      
      expect(result).toEqual({ data: 'test' });
      expect(sdkCall).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('createErrorResponse', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    
    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });
    
    it('should create 400 response for validation errors', () => {
      const error = new Error('Invalid input data');
      const response = createErrorResponse(error);
      
      expect(response.statusCode).toBe(400);
      expect(response.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe(ErrorType.INVALID_INPUT);
      expect(body.error.message).toContain('Invalid input');
    });
    
    it('should create 403 response for access denied errors', () => {
      const error = new Error('Access denied');
      const response = createErrorResponse(error);
      
      expect(response.statusCode).toBe(403);
      
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe(ErrorType.ACCESS_DENIED);
    });
    
    it('should create 404 response for not found errors', () => {
      const error = new Error('Resource not found');
      const response = createErrorResponse(error);
      
      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe(ErrorType.NOT_FOUND);
    });
    
    it('should create 429 response for throttling errors', () => {
      const error = new Error('Rate limit exceeded');
      const response = createErrorResponse(error);
      
      expect(response.statusCode).toBe(429);
      
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe(ErrorType.THROTTLING);
      expect(body.error.retryable).toBe(true);
    });
    
    it('should create 503 response for service unavailable errors', () => {
      const error = new Error('Service unavailable');
      const response = createErrorResponse(error);
      
      expect(response.statusCode).toBe(503);
      
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe(ErrorType.SERVICE_UNAVAILABLE);
    });
    
    it('should create 504 response for timeout errors', () => {
      const error = new Error('Operation timed out');
      const response = createErrorResponse(error);
      
      expect(response.statusCode).toBe(504);
      
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe(ErrorType.TIMEOUT);
    });
    
    it('should create 500 response for unknown errors', () => {
      const error = new Error('Something went wrong');
      const response = createErrorResponse(error);
      
      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body.error.type).toBe(ErrorType.UNKNOWN);
    });
  });
  
  describe('preservePartialSuccess', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    
    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    
    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });
    
    it('should preserve successfully processed data', () => {
      const processedData = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const error = new Error('Processing failed');
      const context: ErrorContext = { operation: 'batch-process' };
      
      const result = preservePartialSuccess(processedData, error, context);
      
      expect(result.successfullyProcessed).toEqual(processedData);
      expect(result.partialSuccess).toBe(true);
      expect(result.error.originalError).toBe(error);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
  
  describe('processBatchWithErrorHandling', () => {
    it('should process all items successfully', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = vi.fn(async (item: number) => item * 2);
      const context: ErrorContext = { operation: 'batch-process' };
      
      const result = await processBatchWithErrorHandling(items, processor, context);
      
      expect(result.successes).toHaveLength(5);
      expect(result.failures).toHaveLength(0);
      expect(result.successes[0].result).toBe(2);
      expect(result.successes[4].result).toBe(10);
    });
    
    it('should continue processing after individual failures', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = vi.fn(async (item: number) => {
        if (item === 2 || item === 4) {
          throw new Error(`Failed to process item ${item}`);
        }
        return item * 2;
      });
      const context: ErrorContext = { operation: 'batch-process' };
      
      const result = await processBatchWithErrorHandling(items, processor, context);
      
      expect(result.successes).toHaveLength(3);
      expect(result.failures).toHaveLength(2);
      
      expect(result.successes[0].item).toBe(1);
      expect(result.successes[1].item).toBe(3);
      expect(result.successes[2].item).toBe(5);
      
      expect(result.failures[0].item).toBe(2);
      expect(result.failures[1].item).toBe(4);
    });
    
    it('should preserve item indices in results', async () => {
      const items = ['a', 'b', 'c'];
      const processor = vi.fn(async (item: string) => item.toUpperCase());
      const context: ErrorContext = { operation: 'batch-process' };
      
      const result = await processBatchWithErrorHandling(items, processor, context);
      
      expect(result.successes[0].index).toBe(0);
      expect(result.successes[1].index).toBe(1);
      expect(result.successes[2].index).toBe(2);
    });
    
    it('should handle all items failing', async () => {
      const items = [1, 2, 3];
      const processor = vi.fn(async () => {
        throw new Error('Always fails');
      });
      const context: ErrorContext = { operation: 'batch-process' };
      
      const result = await processBatchWithErrorHandling(items, processor, context);
      
      expect(result.successes).toHaveLength(0);
      expect(result.failures).toHaveLength(3);
    });
  });
});
