/**
 * AIGradingEngine - Semantic answer comparison using Amazon Bedrock
 * 
 * This class provides methods for:
 * - Grading individual student answers using AI
 * - Batch grading entire submissions
 * - Semantic comparison of answers
 * - Confidence score calculation
 * - Cost tracking for Bedrock API usage
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import {
  QuestionContext,
  ExamContext,
  GradingDecision,
  GradingResult,
  ExtractedAnswers,
  AnswerKeyMapping,
  CostTracking,
} from './exam-types';
import { withAWSRetry, logError, ErrorContext } from './error-handler';

interface BedrockGradingResponse {
  marksAwarded: number;
  confidence: number;
  explanation: string;
  isPartialCredit: boolean;
}

/**
 * Token bucket rate limiter for Bedrock API calls
 * Implements the token bucket algorithm to prevent rate limit errors
 */
class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second
  private lastRefillTime: number;

  constructor(capacity: number = 10, refillRate: number = 2) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefillTime = Date.now();
  }

  /**
   * Attempts to consume a token from the bucket
   * Returns true if successful, false if bucket is empty
   */
  async tryConsume(): Promise<boolean> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Waits until a token is available, then consumes it
   */
  async consume(): Promise<void> {
    while (!(await this.tryConsume())) {
      // Wait for tokens to refill
      const waitTime = Math.ceil(1000 / this.refillRate);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Refills tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRate;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  /**
   * Gets the current number of available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

export class AIGradingEngine {
  private readonly modelId: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly rateLimiter: TokenBucket;

  constructor(
    modelId: string = 'anthropic.claude-3-haiku-20240307-v1:0',
    maxRetries: number = 3,
    timeoutMs: number = 30000,
    rateLimitCapacity: number = 10,
    rateLimitRefillRate: number = 2
  ) {
    this.modelId = modelId;
    this.maxRetries = maxRetries;
    this.timeoutMs = timeoutMs;
    this.rateLimiter = new TokenBucket(rateLimitCapacity, rateLimitRefillRate);
  }

  /**
   * Grades a single student answer using AI semantic comparison
   * 
   * @param studentAnswer - The student's answer text
   * @param expectedAnswer - The expected/correct answer
   * @param questionContext - Context about the question
   * @param customerId - Customer identifier for multi-tenant isolation
   * @returns Grading decision with marks, confidence, and explanation
   * 
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
   */
  async gradeAnswer(
    studentAnswer: string,
    expectedAnswer: string,
    questionContext: QuestionContext,
    customerId: string
  ): Promise<GradingDecision> {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    
    // Initialize Bedrock client
    const bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    // Construct the grading prompt
    const prompt = this.constructGradingPrompt(
      studentAnswer,
      expectedAnswer,
      questionContext
    );

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Wait for rate limiter token before making API call
        await this.rateLimiter.consume();

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Bedrock API call timed out')), this.timeoutMs);
        });

        // Create API call promise
        const apiCallPromise = this.invokeBedrock(bedrockClient, prompt);

        // Race between timeout and API call
        const response = await Promise.race([apiCallPromise, timeoutPromise]);

        // Parse the response
        const gradingResponse = this.parseBedrockResponse(response);

        // Validate the response
        this.validateGradingResponse(gradingResponse, questionContext.maxPoints);

        // Determine if manual review is required (confidence < 70%)
        const requiresReview = gradingResponse.confidence < 70;

        return {
          questionNumber: questionContext.questionNumber,
          marksAwarded: gradingResponse.marksAwarded,
          maxMarks: questionContext.maxPoints,
          confidence: gradingResponse.confidence,
          explanation: gradingResponse.explanation,
          isPartialCredit: gradingResponse.isPartialCredit,
          requiresReview,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error during grading');

        // Check for specific errors that shouldn't be retried
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();

          // Don't retry on validation errors
          if (errorMessage.includes('invalid response') || errorMessage.includes('validation')) {
            throw error;
          }

          // Don't retry on access denied
          if (errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
            throw new Error('Access denied to Bedrock API. Please check IAM permissions.');
          }
          
          // Don't retry on invalid marks/confidence/explanation
          if (errorMessage.includes('invalid marks') || 
              errorMessage.includes('invalid confidence') ||
              errorMessage.includes('explanation cannot be empty')) {
            throw error;
          }

          // Handle timeout errors - retry with shorter context on first timeout
          if (errorMessage.includes('timed out') && attempt === 0) {
            // On first timeout, we'll retry with the same prompt
            // The rate limiter will naturally slow down subsequent requests
            await this.sleep(1000);
            continue;
          }

          // Handle throttling/rate limit errors
          if (errorMessage.includes('throttl') || 
              errorMessage.includes('rate limit') ||
              errorMessage.includes('too many requests')) {
            // Wait longer for rate limit errors
            const backoffTime = 2000 * Math.pow(2, attempt);
            await this.sleep(backoffTime);
            continue;
          }

          // Handle service unavailable errors
          if (errorMessage.includes('service unavailable') || 
              errorMessage.includes('503') ||
              errorMessage.includes('internal server error') ||
              errorMessage.includes('500')) {
            // Retry with exponential backoff
            if (attempt < this.maxRetries - 1) {
              await this.sleep(1000 * Math.pow(2, attempt));
              continue;
            }
          }
        }

        // Exponential backoff before retry for other errors
        if (attempt < this.maxRetries - 1) {
          await this.sleep(1000 * Math.pow(2, attempt));
        }
      }
    }

    // All retries failed - throw error
    throw new Error(`Failed to grade answer after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Grades all answers in a submission using batch processing
   * 
   * @param submission - The extracted student answers
   * @param answerKey - The answer key mappings
   * @param examContext - Context about the exam
   * @param customerId - Customer identifier for multi-tenant isolation
   * @returns Complete grading result with all decisions
   * 
   * Requirements: 5.4, 6.1, 6.2, 6.3, 6.4, 6.5
   */
  async batchGradeSubmission(
    submission: ExtractedAnswers,
    answerKey: AnswerKeyMapping[],
    examContext: ExamContext,
    customerId: string
  ): Promise<GradingResult> {
    const decisions: GradingDecision[] = [];
    let totalBedrockTokensInput = 0;
    let totalBedrockTokensOutput = 0;

    // Create a map of answer key for quick lookup
    const answerKeyMap = new Map<string, AnswerKeyMapping>();
    for (const mapping of answerKey) {
      answerKeyMap.set(mapping.questionNumber, mapping);
    }

    // Grade each answer
    for (const studentAnswer of submission.answers) {
      const answerMapping = answerKeyMap.get(studentAnswer.questionNumber);

      if (!answerMapping) {
        // No answer key for this question - skip or flag
        decisions.push({
          questionNumber: studentAnswer.questionNumber,
          marksAwarded: 0,
          maxMarks: 0,
          confidence: 0,
          explanation: 'No answer key found for this question',
          isPartialCredit: false,
          requiresReview: true,
        });
        continue;
      }

      // Find question context from exam
      const question = examContext.questions.find(
        q => q.questionNumber === studentAnswer.questionNumber
      );

      if (!question) {
        // Question not found in exam structure
        decisions.push({
          questionNumber: studentAnswer.questionNumber,
          marksAwarded: 0,
          maxMarks: 0,
          confidence: 0,
          explanation: 'Question not found in exam structure',
          isPartialCredit: false,
          requiresReview: true,
        });
        continue;
      }

      const questionContext: QuestionContext = {
        questionNumber: question.questionNumber,
        questionText: question.questionText,
        maxPoints: question.points,
        keywords: answerMapping.keywords,
      };

      try {
        // Grade the answer
        const decision = await this.gradeAnswer(
          studentAnswer.extractedText,
          answerMapping.expectedAnswer,
          questionContext,
          customerId
        );

        decisions.push(decision);

        // Estimate token usage (rough approximation)
        // Input: prompt tokens, Output: response tokens
        const inputTokens = this.estimateTokens(
          studentAnswer.extractedText + answerMapping.expectedAnswer + question.questionText
        );
        const outputTokens = this.estimateTokens(decision.explanation);

        totalBedrockTokensInput += inputTokens;
        totalBedrockTokensOutput += outputTokens;
      } catch (error) {
        // If grading fails for this question, flag it for manual review
        decisions.push({
          questionNumber: studentAnswer.questionNumber,
          marksAwarded: 0,
          maxMarks: question.points,
          confidence: 0,
          explanation: `Grading failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isPartialCredit: false,
          requiresReview: true,
        });
      }
    }

    // Calculate total score and average confidence
    const totalScore = decisions.reduce((sum, d) => sum + d.marksAwarded, 0);
    const maxScore = decisions.reduce((sum, d) => sum + d.maxMarks, 0);
    const averageConfidence = decisions.length > 0
      ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length
      : 0;

    // Calculate costs
    const costTracking = this.calculateCosts(
      0, // Textract pages (handled elsewhere)
      totalBedrockTokensInput,
      totalBedrockTokensOutput
    );

    return {
      submissionId: submission.studentId, // Using studentId as placeholder
      studentId: submission.studentId,
      examId: examContext.examId,
      decisions,
      totalScore,
      maxScore,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      gradedAt: new Date().toISOString(),
      costTracking,
    };
  }

  /**
   * Constructs a grading prompt for Bedrock
   * 
   * @param studentAnswer - The student's answer
   * @param expectedAnswer - The expected answer
   * @param questionContext - Context about the question
   * @returns Formatted prompt string
   */
  private constructGradingPrompt(
    studentAnswer: string,
    expectedAnswer: string,
    questionContext: QuestionContext
  ): string {
    return `You are an expert exam grader. Grade the following student answer based on semantic similarity to the expected answer.

Question: ${questionContext.questionText}

Expected Answer: ${expectedAnswer}

Student Answer: ${studentAnswer}

Maximum Points: ${questionContext.maxPoints}

Grading Guidelines:
1. Evaluate semantic similarity, not exact text matching
2. Award full marks if the student's answer conveys the same meaning as the expected answer
3. Award partial credit based on completeness and accuracy of key concepts
4. Consider the keywords: ${questionContext.keywords.join(', ')}
5. Provide a confidence score (0-100) indicating your certainty in the grading decision
6. Provide a brief explanation for your grading decision

Respond ONLY with a JSON object in this exact format (no additional text):
{
  "marksAwarded": <number between 0 and ${questionContext.maxPoints}>,
  "confidence": <number between 0 and 100>,
  "explanation": "<brief explanation of grading decision>",
  "isPartialCredit": <true if marks awarded is between 0 and max, false if 0 or max>
}`;
  }

  /**
   * Invokes Bedrock API with the given prompt
   * 
   * @param client - Bedrock client
   * @param prompt - The prompt to send
   * @returns Raw response from Bedrock
   */
  private async invokeBedrock(
    client: any,
    prompt: string
  ): Promise<string> {
    const { InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');

    // Construct request body for Claude
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent grading
    };

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await client.send(command);

    // Parse response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract text from Claude response
    if (responseBody.content && responseBody.content[0] && responseBody.content[0].text) {
      return responseBody.content[0].text;
    }

    throw new Error('Invalid response format from Bedrock');
  }

  /**
   * Parses Bedrock response into grading response object
   * 
   * @param responseText - Raw response text from Bedrock
   * @returns Parsed grading response
   */
  private parseBedrockResponse(responseText: string): BedrockGradingResponse {
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (
        typeof parsed.marksAwarded !== 'number' ||
        typeof parsed.confidence !== 'number' ||
        typeof parsed.explanation !== 'string' ||
        typeof parsed.isPartialCredit !== 'boolean'
      ) {
        throw new Error('Invalid response structure');
      }

      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse Bedrock response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates grading response values
   * 
   * @param response - The grading response to validate
   * @param maxPoints - Maximum points for the question
   */
  private validateGradingResponse(
    response: BedrockGradingResponse,
    maxPoints: number
  ): void {
    // Validate marks awarded
    if (response.marksAwarded < 0 || response.marksAwarded > maxPoints) {
      throw new Error(`Invalid marks awarded: ${response.marksAwarded}. Must be between 0 and ${maxPoints}`);
    }

    // Validate confidence
    if (response.confidence < 0 || response.confidence > 100) {
      throw new Error(`Invalid confidence: ${response.confidence}. Must be between 0 and 100`);
    }

    // Validate explanation
    if (!response.explanation || response.explanation.trim().length === 0) {
      throw new Error('Explanation cannot be empty');
    }
  }

  /**
   * Estimates token count for text (rough approximation)
   * 
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculates costs for Textract and Bedrock usage
   * 
   * @param textractPages - Number of pages processed by Textract
   * @param bedrockTokensInput - Input tokens used by Bedrock
   * @param bedrockTokensOutput - Output tokens used by Bedrock
   * @returns Cost tracking object
   */
  private calculateCosts(
    textractPages: number,
    bedrockTokensInput: number,
    bedrockTokensOutput: number
  ): CostTracking {
    // AWS pricing (as of 2024, approximate)
    const TEXTRACT_COST_PER_PAGE = 0.0015; // $1.50 per 1000 pages
    const BEDROCK_COST_PER_1K_INPUT_TOKENS = 0.00025; // Claude 3 Haiku pricing
    const BEDROCK_COST_PER_1K_OUTPUT_TOKENS = 0.00125;

    const textractCost = textractPages * TEXTRACT_COST_PER_PAGE;
    const bedrockCost =
      (bedrockTokensInput / 1000) * BEDROCK_COST_PER_1K_INPUT_TOKENS +
      (bedrockTokensOutput / 1000) * BEDROCK_COST_PER_1K_OUTPUT_TOKENS;

    return {
      textractPages,
      textractCost: Math.round(textractCost * 1000000) / 1000000, // Round to 6 decimal places
      bedrockTokensInput,
      bedrockTokensOutput,
      bedrockCost: Math.round(bedrockCost * 1000000) / 1000000,
      totalCost: Math.round((textractCost + bedrockCost) * 1000000) / 1000000,
    };
  }

  /**
   * Sleep utility for retry delays
   * 
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
