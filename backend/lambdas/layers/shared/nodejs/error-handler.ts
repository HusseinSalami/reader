/**
 * Error Handler - Comprehensive error handling utilities
 * 
 * This module provides:
 * - Retry logic with exponential backoff for AWS service calls
 * - Error logging with context
 * - User-friendly error message generation
 * - Error classification and handling strategies
 * 
 * Requirements: 19.1, 19.2, 19.3, 19.6
 */

/**
 * Error types for classification
 */
export enum ErrorType {
  // AWS Service Errors
  THROTTLING = 'THROTTLING',
  ACCESS_DENIED = 'ACCESS_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  
  // Application Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  EXTRACTION_ERROR = 'EXTRACTION_ERROR',
  GRADING_ERROR = 'GRADING_ERROR',
  DATA_PERSISTENCE_ERROR = 'DATA_PERSISTENCE_ERROR',
  
  // Unknown
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error context for logging
 */
export interface ErrorContext {
  operation: string;
  customerId?: string;
  examId?: string;
  submissionId?: string;
  questionNumber?: string;
  documentUrl?: string;
  additionalInfo?: Record<string, any>;
}

/**
 * Classified error with type and user-friendly message
 */
export interface ClassifiedError {
  type: ErrorType;
  originalError: Error;
  userMessage: string;
  shouldRetry: boolean;
  context?: ErrorContext;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: ErrorType[];
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorType.THROTTLING,
    ErrorType.SERVICE_UNAVAILABLE,
    ErrorType.TIMEOUT,
  ],
};

/**
 * Classifies an error into a specific error type
 * 
 * @param error - The error to classify
 * @param context - Optional context about the operation
 * @returns Classified error with type and user message
 */
export function classifyError(
  error: Error,
  context?: ErrorContext
): ClassifiedError {
  const errorMessage = error.message.toLowerCase();
  
  // Check for throttling errors
  if (
    errorMessage.includes('throttl') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('requestlimitexceeded')
  ) {
    return {
      type: ErrorType.THROTTLING,
      originalError: error,
      userMessage: 'Service rate limit exceeded. Please wait a moment and try again.',
      shouldRetry: true,
      context,
    };
  }
  
  // Check for access denied errors
  if (
    errorMessage.includes('access denied') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('accessdeniedexception')
  ) {
    return {
      type: ErrorType.ACCESS_DENIED,
      originalError: error,
      userMessage: 'Access denied. Please check permissions and try again.',
      shouldRetry: false,
      context,
    };
  }
  
  // Check for not found errors
  if (
    errorMessage.includes('not found') ||
    errorMessage.includes('does not exist') ||
    errorMessage.includes('nosuchkey') ||
    errorMessage.includes('resourcenotfound')
  ) {
    return {
      type: ErrorType.NOT_FOUND,
      originalError: error,
      userMessage: 'Resource not found. Please verify the information and try again.',
      shouldRetry: false,
      context,
    };
  }
  
  // Check for invalid input errors
  if (
    errorMessage.includes('invalid') ||
    errorMessage.includes('malformed') ||
    errorMessage.includes('validation') ||
    errorMessage.includes('bad request')
  ) {
    return {
      type: ErrorType.INVALID_INPUT,
      originalError: error,
      userMessage: 'Invalid input. Please check your data and try again.',
      shouldRetry: false,
      context,
    };
  }
  
  // Check for service unavailable errors
  if (
    errorMessage.includes('service unavailable') ||
    errorMessage.includes('503') ||
    errorMessage.includes('internal server error') ||
    errorMessage.includes('500') ||
    errorMessage.includes('serviceunavailable')
  ) {
    return {
      type: ErrorType.SERVICE_UNAVAILABLE,
      originalError: error,
      userMessage: 'Service temporarily unavailable. Please try again in a moment.',
      shouldRetry: true,
      context,
    };
  }
  
  // Check for timeout errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorMessage.includes('deadline exceeded')
  ) {
    return {
      type: ErrorType.TIMEOUT,
      originalError: error,
      userMessage: 'Operation timed out. Please try again.',
      shouldRetry: true,
      context,
    };
  }
  
  // Check for extraction errors
  if (
    errorMessage.includes('extraction') ||
    errorMessage.includes('no content extracted') ||
    errorMessage.includes('no text lines')
  ) {
    return {
      type: ErrorType.EXTRACTION_ERROR,
      originalError: error,
      userMessage: error.message, // Use original message as it's already user-friendly
      shouldRetry: false,
      context,
    };
  }
  
  // Check for grading errors
  if (
    errorMessage.includes('grading') ||
    errorMessage.includes('bedrock')
  ) {
    return {
      type: ErrorType.GRADING_ERROR,
      originalError: error,
      userMessage: 'Grading failed. The question will be flagged for manual review.',
      shouldRetry: true,
      context,
    };
  }
  
  // Check for data persistence errors
  if (
    errorMessage.includes('dynamodb') ||
    errorMessage.includes('s3') ||
    errorMessage.includes('database')
  ) {
    return {
      type: ErrorType.DATA_PERSISTENCE_ERROR,
      originalError: error,
      userMessage: 'Failed to save data. Please try again.',
      shouldRetry: true,
      context,
    };
  }
  
  // Unknown error
  return {
    type: ErrorType.UNKNOWN,
    originalError: error,
    userMessage: `An unexpected error occurred: ${error.message}`,
    shouldRetry: false,
    context,
  };
}

/**
 * Logs an error with context
 * 
 * @param error - The error to log
 * @param context - Context about the operation
 * @param additionalInfo - Additional information to log
 * 
 * Requirement: 19.2 - Add error logging with context
 */
export function logError(
  error: Error | ClassifiedError,
  context?: ErrorContext,
  additionalInfo?: Record<string, any>
): void {
  const classifiedError = 'type' in error ? error : classifyError(error, context);
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    errorType: classifiedError.type,
    errorMessage: classifiedError.originalError.message,
    userMessage: classifiedError.userMessage,
    shouldRetry: classifiedError.shouldRetry,
    context: classifiedError.context || context,
    additionalInfo,
    stack: classifiedError.originalError.stack,
  };
  
  // Log to CloudWatch
  console.error('Error occurred:', JSON.stringify(logEntry, null, 2));
}

/**
 * Executes an operation with retry logic and exponential backoff
 * 
 * @param operation - The async operation to execute
 * @param context - Context about the operation
 * @param config - Retry configuration
 * @returns Result of the operation
 * 
 * Requirement: 19.1 - Implement retry logic for AWS service calls
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: ClassifiedError | null = null;
  
  for (let attempt = 0; attempt < retryConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const classifiedError = classifyError(
        error instanceof Error ? error : new Error(String(error)),
        context
      );
      
      lastError = classifiedError;
      
      // Log the error
      logError(classifiedError, context, { attempt: attempt + 1 });
      
      // Check if we should retry
      if (!classifiedError.shouldRetry) {
        throw classifiedError;
      }
      
      // Check if error type is retryable
      if (
        retryConfig.retryableErrors &&
        !retryConfig.retryableErrors.includes(classifiedError.type)
      ) {
        throw classifiedError;
      }
      
      // Don't retry on last attempt
      if (attempt === retryConfig.maxRetries - 1) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt),
        retryConfig.maxDelayMs
      );
      
      console.log(`Retrying operation after ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`);
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // All retries failed
  if (lastError) {
    throw lastError;
  }
  
  throw new Error('Operation failed after all retries');
}

/**
 * Wraps an AWS SDK call with retry logic
 * 
 * @param sdkCall - The AWS SDK call to execute
 * @param serviceName - Name of the AWS service (for logging)
 * @param context - Context about the operation
 * @param config - Retry configuration
 * @returns Result of the SDK call
 * 
 * Requirement: 19.1 - Implement retry logic for AWS service calls
 */
export async function withAWSRetry<T>(
  sdkCall: () => Promise<T>,
  serviceName: string,
  context: ErrorContext,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const operationContext = {
    ...context,
    operation: `${serviceName} API call`,
  };
  
  return withRetry(sdkCall, operationContext, config);
}

/**
 * Creates a user-friendly error response for API Gateway
 * 
 * @param error - The error to convert
 * @param context - Context about the operation
 * @returns API Gateway response object
 * 
 * Requirement: 19.3 - Return user-friendly error messages
 */
export function createErrorResponse(
  error: Error | ClassifiedError,
  context?: ErrorContext
): {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
} {
  const classifiedError = 'type' in error ? error : classifyError(error, context);
  
  // Log the error
  logError(classifiedError, context);
  
  // Determine HTTP status code
  let statusCode = 500;
  switch (classifiedError.type) {
    case ErrorType.VALIDATION_ERROR:
    case ErrorType.INVALID_INPUT:
      statusCode = 400;
      break;
    case ErrorType.ACCESS_DENIED:
      statusCode = 403;
      break;
    case ErrorType.NOT_FOUND:
      statusCode = 404;
      break;
    case ErrorType.THROTTLING:
      statusCode = 429;
      break;
    case ErrorType.SERVICE_UNAVAILABLE:
      statusCode = 503;
      break;
    case ErrorType.TIMEOUT:
      statusCode = 504;
      break;
    default:
      statusCode = 500;
  }
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: {
        type: classifiedError.type,
        message: classifiedError.userMessage,
        retryable: classifiedError.shouldRetry,
      },
    }),
  };
}

/**
 * Wraps a Lambda handler with error handling
 * 
 * @param handler - The Lambda handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling<TEvent, TResult>(
  handler: (event: TEvent) => Promise<TResult>
): (event: TEvent) => Promise<TResult | ReturnType<typeof createErrorResponse>> {
  return async (event: TEvent) => {
    try {
      return await handler(event);
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };
}

/**
 * Sleep utility for delays
 * 
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Preserves successfully processed data when an error occurs
 * 
 * @param processedData - Data that was successfully processed
 * @param error - The error that occurred
 * @param context - Context about the operation
 * @returns Object with processed data and error information
 * 
 * Requirement: 19.6 - Preserve successfully processed data on errors
 */
export function preservePartialSuccess<T>(
  processedData: T[],
  error: Error,
  context: ErrorContext
): {
  successfullyProcessed: T[];
  error: ClassifiedError;
  partialSuccess: boolean;
} {
  const classifiedError = classifyError(error, context);
  
  // Log partial success
  console.warn('Partial success:', {
    successfullyProcessed: processedData.length,
    error: classifiedError.userMessage,
    context,
  });
  
  return {
    successfullyProcessed: processedData,
    error: classifiedError,
    partialSuccess: true,
  };
}

/**
 * Batch operation error handler
 * Continues processing remaining items when individual items fail
 * 
 * @param items - Items to process
 * @param processor - Function to process each item
 * @param context - Context about the operation
 * @returns Results with successes and failures
 * 
 * Requirement: 19.6 - Preserve successfully processed data on errors
 */
export async function processBatchWithErrorHandling<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput, index: number) => Promise<TOutput>,
  context: ErrorContext
): Promise<{
  successes: Array<{ index: number; item: TInput; result: TOutput }>;
  failures: Array<{ index: number; item: TInput; error: ClassifiedError }>;
}> {
  const successes: Array<{ index: number; item: TInput; result: TOutput }> = [];
  const failures: Array<{ index: number; item: TInput; error: ClassifiedError }> = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    try {
      const result = await processor(item, i);
      successes.push({ index: i, item, result });
    } catch (error) {
      const classifiedError = classifyError(
        error instanceof Error ? error : new Error(String(error)),
        { ...context, additionalInfo: { itemIndex: i } }
      );
      
      // Log the error but continue processing
      logError(classifiedError, context, { itemIndex: i });
      
      failures.push({ index: i, item, error: classifiedError });
    }
  }
  
  return { successes, failures };
}
