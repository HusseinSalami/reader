/**
 * Tests for AIGradingEngine
 * 
 * Tests cover:
 * - Single answer grading
 * - Batch submission grading
 * - Semantic comparison
 * - Confidence score calculation
 * - Partial credit assignment
 * - Error handling and retries
 * - Cost tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIGradingEngine } from './ai-grading-engine';
import {
  QuestionContext,
  ExamContext,
  ExtractedAnswers,
  AnswerKeyMapping,
} from './exam-types';

// Create mock send function
const mockSend = vi.fn();

// Mock AWS SDK
vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    InvokeModelCommand: vi.fn(),
  };
});

describe('AIGradingEngine', () => {
  let engine: AIGradingEngine;

  beforeEach(() => {
    engine = new AIGradingEngine();
    vi.clearAllMocks();
  });

  describe('gradeAnswer', () => {
    const questionContext: QuestionContext = {
      questionNumber: '1',
      questionText: 'What is the capital of France?',
      maxPoints: 5,
      keywords: ['Paris', 'France', 'capital'],
    };

    it('should grade a correct answer with high confidence', async () => {
      // Mock Bedrock response
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 5,
              confidence: 95,
              explanation: 'The answer correctly identifies Paris as the capital of France.',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      const result = await engine.gradeAnswer(
        'Paris',
        'Paris',
        questionContext,
        'customer-123'
      );

      expect(result.questionNumber).toBe('1');
      expect(result.marksAwarded).toBe(5);
      expect(result.maxMarks).toBe(5);
      expect(result.confidence).toBe(95);
      expect(result.explanation).toContain('Paris');
      expect(result.isPartialCredit).toBe(false);
      expect(result.requiresReview).toBe(false); // High confidence
    });

    it('should recognize semantically equivalent answers', async () => {
      // Mock Bedrock response for semantically similar answer
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 5,
              confidence: 90,
              explanation: 'The answer is semantically equivalent to the expected answer.',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      const result = await engine.gradeAnswer(
        'The capital city of France is Paris',
        'Paris',
        questionContext,
        'customer-123'
      );

      expect(result.marksAwarded).toBe(5);
      expect(result.confidence).toBe(90);
    });

    it('should assign partial credit for incomplete answers', async () => {
      // Mock Bedrock response for partial credit
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 3,
              confidence: 85,
              explanation: 'The answer is partially correct but lacks some details.',
              isPartialCredit: true,
            }),
          }],
        })),
      });

      const result = await engine.gradeAnswer(
        'Paris is in France',
        'Paris is the capital city of France',
        questionContext,
        'customer-123'
      );

      expect(result.marksAwarded).toBe(3);
      expect(result.isPartialCredit).toBe(true);
      expect(result.confidence).toBe(85);
    });

    it('should flag low confidence answers for manual review', async () => {
      // Mock Bedrock response with low confidence
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 2,
              confidence: 60,
              explanation: 'The answer is unclear and requires manual review.',
              isPartialCredit: true,
            }),
          }],
        })),
      });

      const result = await engine.gradeAnswer(
        'Some city in Europe',
        'Paris',
        questionContext,
        'customer-123'
      );

      expect(result.requiresReview).toBe(true); // Confidence < 70%
      expect(result.confidence).toBe(60);
    });

    it('should assign zero marks for incorrect answers', async () => {
      // Mock Bedrock response for incorrect answer
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 0,
              confidence: 95,
              explanation: 'The answer is incorrect. London is the capital of the UK, not France.',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      const result = await engine.gradeAnswer(
        'London',
        'Paris',
        questionContext,
        'customer-123'
      );

      expect(result.marksAwarded).toBe(0);
      expect(result.confidence).toBe(95);
    });

    it('should include explanation in grading decision', async () => {
      // Mock Bedrock response
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 5,
              confidence: 95,
              explanation: 'Correct answer with proper identification.',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      const result = await engine.gradeAnswer(
        'Paris',
        'Paris',
        questionContext,
        'customer-123'
      );

      expect(result.explanation).toBeTruthy();
      expect(result.explanation.length).toBeGreaterThan(0);
    });

    it('should retry on transient failures', async () => {
      // First call fails, second succeeds
      mockSend
        .mockRejectedValueOnce(new Error('Throttling error'))
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                marksAwarded: 5,
                confidence: 95,
                explanation: 'Correct answer.',
                isPartialCredit: false,
              }),
            }],
          })),
        });

      const result = await engine.gradeAnswer(
        'Paris',
        'Paris',
        questionContext,
        'customer-123'
      );

      expect(result.marksAwarded).toBe(5);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      // All calls fail
      mockSend.mockRejectedValue(new Error('Service unavailable'));

      await expect(
        engine.gradeAnswer('Paris', 'Paris', questionContext, 'customer-123')
      ).rejects.toThrow('Failed to grade answer after 3 attempts');
    });

    it('should handle invalid JSON responses', async () => {
      // Mock invalid response
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'This is not valid JSON',
          }],
        })),
      });

      await expect(
        engine.gradeAnswer('Paris', 'Paris', questionContext, 'customer-123')
      ).rejects.toThrow('Failed to parse Bedrock response');
    });

    it('should validate marks are within bounds', async () => {
      // Mock response with invalid marks
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 10, // Exceeds maxPoints of 5
              confidence: 95,
              explanation: 'Invalid marks',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      await expect(
        engine.gradeAnswer('Paris', 'Paris', questionContext, 'customer-123')
      ).rejects.toThrow('Invalid marks awarded');
    });

    it('should validate confidence is within bounds', async () => {
      // Mock response with invalid confidence
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 5,
              confidence: 150, // Exceeds 100
              explanation: 'Invalid confidence',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      await expect(
        engine.gradeAnswer('Paris', 'Paris', questionContext, 'customer-123')
      ).rejects.toThrow('Invalid confidence');
    });

    it('should require non-empty explanation', async () => {
      // Mock response with empty explanation
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 5,
              confidence: 95,
              explanation: '',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      await expect(
        engine.gradeAnswer('Paris', 'Paris', questionContext, 'customer-123')
      ).rejects.toThrow('Explanation cannot be empty');
    });

    it('should handle throttling errors with exponential backoff', async () => {
      // First two calls fail with throttling, third succeeds
      mockSend
        .mockRejectedValueOnce(new Error('ThrottlingException: Rate exceeded'))
        .mockRejectedValueOnce(new Error('Too many requests'))
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                marksAwarded: 5,
                confidence: 95,
                explanation: 'Correct answer.',
                isPartialCredit: false,
              }),
            }],
          })),
        });

      const result = await engine.gradeAnswer(
        'Paris',
        'Paris',
        questionContext,
        'customer-123'
      );

      expect(result.marksAwarded).toBe(5);
      expect(mockSend).toHaveBeenCalledTimes(3);
    }, 10000); // Increase timeout for backoff delays

    it('should handle service unavailable errors with retry', async () => {
      // First call fails with 503, second succeeds
      mockSend
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                marksAwarded: 5,
                confidence: 95,
                explanation: 'Correct answer.',
                isPartialCredit: false,
              }),
            }],
          })),
        });

      const result = await engine.gradeAnswer(
        'Paris',
        'Paris',
        questionContext,
        'customer-123'
      );

      expect(result.marksAwarded).toBe(5);
      expect(mockSend).toHaveBeenCalledTimes(2);
    }, 5000);

    it('should handle timeout errors and retry', async () => {
      // Create a custom engine with shorter timeout for testing
      const shortTimeoutEngine = new AIGradingEngine(
        'anthropic.claude-3-haiku-20240307-v1:0',
        2, // Only 2 retries for faster test
        100 // 100ms timeout
      );

      // First call times out (takes 200ms), second succeeds quickly
      let callCount = 0;
      mockSend.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call takes too long
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                body: new TextEncoder().encode(JSON.stringify({
                  content: [{
                    text: JSON.stringify({
                      marksAwarded: 5,
                      confidence: 95,
                      explanation: 'Correct answer.',
                      isPartialCredit: false,
                    }),
                  }],
                })),
              });
            }, 200);
          });
        } else {
          // Second call succeeds quickly
          return Promise.resolve({
            body: new TextEncoder().encode(JSON.stringify({
              content: [{
                text: JSON.stringify({
                  marksAwarded: 5,
                  confidence: 95,
                  explanation: 'Correct answer.',
                  isPartialCredit: false,
                }),
              }],
            })),
          });
        }
      });

      const result = await shortTimeoutEngine.gradeAnswer(
        'Paris',
        'Paris',
        questionContext,
        'customer-123'
      );

      expect(result.marksAwarded).toBe(5);
      // Should have at least 2 calls (first timeout, second success)
      expect(mockSend.mock.calls.length).toBeGreaterThanOrEqual(2);
    }, 5000);

    it('should not retry on access denied errors', async () => {
      // Mock access denied error
      mockSend.mockRejectedValue(new Error('Access denied to Bedrock'));

      await expect(
        engine.gradeAnswer('Paris', 'Paris', questionContext, 'customer-123')
      ).rejects.toThrow('Access denied to Bedrock API');

      // Should only try once, not retry
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should use rate limiter to prevent excessive API calls', async () => {
      // Create engine with very limited rate (1 token capacity, 0.5 tokens/sec)
      const rateLimitedEngine = new AIGradingEngine(
        'anthropic.claude-3-haiku-20240307-v1:0',
        3,
        30000,
        1, // capacity: 1 token
        0.5 // refill rate: 0.5 tokens/sec
      );

      // Mock successful responses
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 5,
              confidence: 95,
              explanation: 'Correct answer.',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      const startTime = Date.now();

      // Make 3 consecutive calls - should be rate limited
      await rateLimitedEngine.gradeAnswer('Paris', 'Paris', questionContext, 'customer-123');
      await rateLimitedEngine.gradeAnswer('Paris', 'Paris', questionContext, 'customer-123');
      await rateLimitedEngine.gradeAnswer('Paris', 'Paris', questionContext, 'customer-123');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // With rate limiting, 3 calls should take at least 4 seconds
      // (first call immediate, second after 2s, third after 2s more)
      expect(duration).toBeGreaterThan(3000);
      expect(mockSend).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe('batchGradeSubmission', () => {
    const examContext: ExamContext = {
      examId: 'exam-123',
      examTitle: 'Geography Quiz',
      totalPoints: 15,
      questions: [
        {
          questionNumber: '1',
          questionText: 'What is the capital of France?',
          points: 5,
          sectionId: 'section-1',
        },
        {
          questionNumber: '2',
          questionText: 'What is the capital of Germany?',
          points: 5,
          sectionId: 'section-1',
        },
        {
          questionNumber: '3',
          questionText: 'What is the capital of Italy?',
          points: 5,
          sectionId: 'section-1',
        },
      ],
    };

    const answerKey: AnswerKeyMapping[] = [
      {
        questionNumber: '1',
        expectedAnswer: 'Paris',
        keywords: ['Paris', 'France'],
      },
      {
        questionNumber: '2',
        expectedAnswer: 'Berlin',
        keywords: ['Berlin', 'Germany'],
      },
      {
        questionNumber: '3',
        expectedAnswer: 'Rome',
        keywords: ['Rome', 'Italy'],
      },
    ];

    const submission: ExtractedAnswers = {
      studentId: 'student-123',
      answers: [
        {
          questionNumber: '1',
          extractedText: 'Paris',
          confidence: 95,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
        },
        {
          questionNumber: '2',
          extractedText: 'Berlin',
          confidence: 90,
          boundingBox: { top: 0.2, left: 0.1, width: 0.3, height: 0.05 },
        },
        {
          questionNumber: '3',
          extractedText: 'Rome',
          confidence: 92,
          boundingBox: { top: 0.3, left: 0.1, width: 0.3, height: 0.05 },
        },
      ],
      overallConfidence: 92,
      flaggedForReview: [],
    };

    it('should grade all answers in a submission', async () => {
      // Mock Bedrock responses for all questions
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 5,
              confidence: 95,
              explanation: 'Correct answer.',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      const result = await engine.batchGradeSubmission(
        submission,
        answerKey,
        examContext,
        'customer-123'
      );

      expect(result.decisions).toHaveLength(3);
      expect(result.totalScore).toBe(15); // All correct
      expect(result.maxScore).toBe(15);
      expect(result.studentId).toBe('student-123');
      expect(result.examId).toBe('exam-123');
    });

    it('should calculate total score correctly', async () => {
      // Mock different scores for each question
      mockSend
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                marksAwarded: 5,
                confidence: 95,
                explanation: 'Correct.',
                isPartialCredit: false,
              }),
            }],
          })),
        })
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                marksAwarded: 3,
                confidence: 80,
                explanation: 'Partially correct.',
                isPartialCredit: true,
              }),
            }],
          })),
        })
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                marksAwarded: 0,
                confidence: 90,
                explanation: 'Incorrect.',
                isPartialCredit: false,
              }),
            }],
          })),
        });

      const result = await engine.batchGradeSubmission(
        submission,
        answerKey,
        examContext,
        'customer-123'
      );

      expect(result.totalScore).toBe(8); // 5 + 3 + 0
      expect(result.maxScore).toBe(15);
    });

    it('should calculate average confidence', async () => {
      // Mock responses with different confidence levels
      mockSend
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                marksAwarded: 5,
                confidence: 90,
                explanation: 'Correct.',
                isPartialCredit: false,
              }),
            }],
          })),
        })
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                marksAwarded: 5,
                confidence: 80,
                explanation: 'Correct.',
                isPartialCredit: false,
              }),
            }],
          })),
        })
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                marksAwarded: 5,
                confidence: 70,
                explanation: 'Correct.',
                isPartialCredit: false,
              }),
            }],
          })),
        });

      const result = await engine.batchGradeSubmission(
        submission,
        answerKey,
        examContext,
        'customer-123'
      );

      expect(result.averageConfidence).toBe(80); // (90 + 80 + 70) / 3
    });

    it('should include cost tracking information', async () => {
      // Mock Bedrock response
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 5,
              confidence: 95,
              explanation: 'Correct answer.',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      const result = await engine.batchGradeSubmission(
        submission,
        answerKey,
        examContext,
        'customer-123'
      );

      expect(result.costTracking).toBeDefined();
      expect(result.costTracking.bedrockTokensInput).toBeGreaterThan(0);
      expect(result.costTracking.bedrockTokensOutput).toBeGreaterThan(0);
      expect(result.costTracking.bedrockCost).toBeGreaterThan(0);
      expect(result.costTracking.totalCost).toBeGreaterThan(0);
    });

    it('should handle missing answer key gracefully', async () => {
      const incompleteAnswerKey: AnswerKeyMapping[] = [
        {
          questionNumber: '1',
          expectedAnswer: 'Paris',
          keywords: ['Paris'],
        },
        // Missing answer key for question 2 and 3
      ];

      const result = await engine.batchGradeSubmission(
        submission,
        incompleteAnswerKey,
        examContext,
        'customer-123'
      );

      // Should have decisions for all questions
      expect(result.decisions).toHaveLength(3);
      
      // Questions without answer key should be flagged for review
      expect(result.decisions[1].requiresReview).toBe(true);
      expect(result.decisions[2].requiresReview).toBe(true);
      expect(result.decisions[1].explanation).toContain('No answer key');
      expect(result.decisions[2].explanation).toContain('No answer key');
    });

    it('should continue grading if one question fails', async () => {
      // First question succeeds, second fails all retries, third succeeds
      let callCount = 0;
      mockSend.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First question succeeds
          return Promise.resolve({
            body: new TextEncoder().encode(JSON.stringify({
              content: [{
                text: JSON.stringify({
                  marksAwarded: 5,
                  confidence: 95,
                  explanation: 'Correct.',
                  isPartialCredit: false,
                }),
              }],
            })),
          });
        } else if (callCount >= 2 && callCount <= 4) {
          // Second question fails all 3 retries
          return Promise.reject(new Error('API error'));
        } else {
          // Third question succeeds
          return Promise.resolve({
            body: new TextEncoder().encode(JSON.stringify({
              content: [{
                text: JSON.stringify({
                  marksAwarded: 5,
                  confidence: 95,
                  explanation: 'Correct.',
                  isPartialCredit: false,
                }),
              }],
            })),
          });
        }
      });

      const result = await engine.batchGradeSubmission(
        submission,
        answerKey,
        examContext,
        'customer-123'
      );

      expect(result.decisions).toHaveLength(3);
      expect(result.decisions[0].marksAwarded).toBe(5);
      expect(result.decisions[1].requiresReview).toBe(true); // Failed question
      expect(result.decisions[1].explanation).toContain('Grading failed');
      expect(result.decisions[2].marksAwarded).toBe(5);
    });

    it('should include timestamp in result', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              marksAwarded: 5,
              confidence: 95,
              explanation: 'Correct.',
              isPartialCredit: false,
            }),
          }],
        })),
      });

      const result = await engine.batchGradeSubmission(
        submission,
        answerKey,
        examContext,
        'customer-123'
      );

      expect(result.gradedAt).toBeTruthy();
      expect(new Date(result.gradedAt).getTime()).toBeGreaterThan(0);
    });
  });
});
