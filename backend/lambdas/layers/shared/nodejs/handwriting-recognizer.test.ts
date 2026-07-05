/**
 * Tests for HandwritingRecognizer
 * 
 * Tests cover:
 * - Handwritten text extraction
 * - Spatial analysis and question mapping
 * - Confidence score calculation
 * - Low-confidence flagging
 * - Multi-page handling
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandwritingRecognizer } from './handwriting-recognizer';
import { ExtractedQuestionnaire } from './exam-types';

// Create mock send function
const mockSend = vi.fn();

// Mock AWS SDK
vi.mock('@aws-sdk/client-textract', () => {
  return {
    TextractClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    AnalyzeDocumentCommand: vi.fn(),
  };
});

describe('HandwritingRecognizer', () => {
  let recognizer: HandwritingRecognizer;

  beforeEach(() => {
    recognizer = new HandwritingRecognizer();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('extractHandwrittenAnswers', () => {
    const examStructure: ExtractedQuestionnaire = {
      sections: [
        {
          sectionNumber: 1,
          sectionTitle: 'Section A',
          questions: [
            {
              questionNumber: '1',
              questionText: 'What is the capital of France?',
              points: 5,
              sectionId: 'section-1',
            },
            {
              questionNumber: '2',
              questionText: 'Explain photosynthesis.',
              points: 10,
              sectionId: 'section-1',
            },
          ],
        },
      ],
      totalQuestions: 2,
      extractionConfidence: 95,
    };

    it('should extract handwritten answers from a submission', async () => {
      // Mock Textract response
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'LINE',
            Text: '1. Paris',
            Confidence: 95,
            Geometry: {
              BoundingBox: {
                Top: 0.1,
                Left: 0.1,
                Width: 0.3,
                Height: 0.05,
              },
            },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: '2. Photosynthesis is the process',
            Confidence: 90,
            Geometry: {
              BoundingBox: {
                Top: 0.2,
                Left: 0.1,
                Width: 0.5,
                Height: 0.05,
              },
            },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: 'by which plants convert light into energy.',
            Confidence: 88,
            Geometry: {
              BoundingBox: {
                Top: 0.25,
                Left: 0.1,
                Width: 0.6,
                Height: 0.05,
              },
            },
            Page: 1,
          },
        ],
      });

      const result = await recognizer.extractHandwrittenAnswers(
        's3://test-bucket/submission.pdf',
        examStructure,
        'customer-123'
      );

      expect(result.answers).toHaveLength(2);
      expect(result.answers[0].questionNumber).toBe('1');
      expect(result.answers[0].extractedText).toBe('Paris');
      expect(result.answers[1].questionNumber).toBe('2');
      expect(result.answers[1].extractedText).toContain('Photosynthesis');
      expect(result.overallConfidence).toBeGreaterThan(0);
    });

    it('should handle multi-page submissions', async () => {
      // Mock Textract response with multiple pages
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'LINE',
            Text: '1. Answer on page 1',
            Confidence: 95,
            Geometry: {
              BoundingBox: { Top: 0.1, Left: 0.1, Width: 0.3, Height: 0.05 },
            },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: '2. Answer on page 2',
            Confidence: 90,
            Geometry: {
              BoundingBox: { Top: 0.1, Left: 0.1, Width: 0.3, Height: 0.05 },
            },
            Page: 2,
          },
        ],
      });

      const result = await recognizer.extractHandwrittenAnswers(
        's3://test-bucket/submission.pdf',
        examStructure,
        'customer-123'
      );

      expect(result.answers).toHaveLength(2);
      expect(result.answers[0].questionNumber).toBe('1');
      expect(result.answers[1].questionNumber).toBe('2');
    });

    it('should flag low-confidence answers (<50%) for manual review', async () => {
      // Mock Textract response with low confidence
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'LINE',
            Text: '1. Low confidence answer',
            Confidence: 45,
            Geometry: {
              BoundingBox: { Top: 0.1, Left: 0.1, Width: 0.3, Height: 0.05 },
            },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: '2. High confidence answer',
            Confidence: 95,
            Geometry: {
              BoundingBox: { Top: 0.2, Left: 0.1, Width: 0.3, Height: 0.05 },
            },
            Page: 1,
          },
        ],
      });

      const result = await recognizer.extractHandwrittenAnswers(
        's3://test-bucket/submission.pdf',
        examStructure,
        'customer-123'
      );

      expect(result.flaggedForReview).toContain('1');
      expect(result.flaggedForReview).not.toContain('2');
    });

    it('should calculate confidence scores for each answer', async () => {
      // Mock Textract response
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'LINE',
            Text: '1. First line',
            Confidence: 90,
            Geometry: {
              BoundingBox: { Top: 0.1, Left: 0.1, Width: 0.3, Height: 0.05 },
            },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: 'Second line',
            Confidence: 80,
            Geometry: {
              BoundingBox: { Top: 0.15, Left: 0.1, Width: 0.3, Height: 0.05 },
            },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: '2. Another answer',
            Confidence: 95,
            Geometry: {
              BoundingBox: { Top: 0.2, Left: 0.1, Width: 0.3, Height: 0.05 },
            },
            Page: 1,
          },
        ],
      });

      const result = await recognizer.extractHandwrittenAnswers(
        's3://test-bucket/submission.pdf',
        examStructure,
        'customer-123'
      );

      // First answer should have average of 90 and 80 = 85
      expect(result.answers[0].confidence).toBe(85);
      // Second answer should have confidence of 95
      expect(result.answers[1].confidence).toBe(95);
    });

    it('should include bounding box information for each answer', async () => {
      // Mock Textract response
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'LINE',
            Text: '1. Answer text',
            Confidence: 95,
            Geometry: {
              BoundingBox: {
                Top: 0.1,
                Left: 0.2,
                Width: 0.3,
                Height: 0.05,
              },
            },
            Page: 1,
          },
        ],
      });

      const result = await recognizer.extractHandwrittenAnswers(
        's3://test-bucket/submission.pdf',
        examStructure,
        'customer-123'
      );

      expect(result.answers[0].boundingBox).toEqual({
        top: 0.1,
        left: 0.2,
        width: 0.3,
        height: 0.05,
      });
    });

    it('should handle various question number formats', async () => {
      const examWithVariousFormats: ExtractedQuestionnaire = {
        sections: [
          {
            sectionNumber: 1,
            sectionTitle: 'Section A',
            questions: [
              { questionNumber: '1', questionText: 'Q1', points: 5, sectionId: 'section-1' },
              { questionNumber: '2', questionText: 'Q2', points: 5, sectionId: 'section-1' },
              { questionNumber: '3', questionText: 'Q3', points: 5, sectionId: 'section-1' },
              { questionNumber: '4', questionText: 'Q4', points: 5, sectionId: 'section-1' },
            ],
          },
        ],
        totalQuestions: 4,
        extractionConfidence: 95,
      };

      // Mock Textract response with various formats
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'LINE',
            Text: '1. Answer with period',
            Confidence: 95,
            Geometry: { BoundingBox: { Top: 0.1, Left: 0.1, Width: 0.3, Height: 0.05 } },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: '2) Answer with parenthesis',
            Confidence: 95,
            Geometry: { BoundingBox: { Top: 0.2, Left: 0.1, Width: 0.3, Height: 0.05 } },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: 'Q3. Answer with Q prefix',
            Confidence: 95,
            Geometry: { BoundingBox: { Top: 0.3, Left: 0.1, Width: 0.3, Height: 0.05 } },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: '(4) Answer with parentheses',
            Confidence: 95,
            Geometry: { BoundingBox: { Top: 0.4, Left: 0.1, Width: 0.3, Height: 0.05 } },
            Page: 1,
          },
        ],
      });

      const result = await recognizer.extractHandwrittenAnswers(
        's3://test-bucket/submission.pdf',
        examWithVariousFormats,
        'customer-123'
      );

      expect(result.answers).toHaveLength(4);
      expect(result.answers[0].questionNumber).toBe('1');
      expect(result.answers[1].questionNumber).toBe('2');
      expect(result.answers[2].questionNumber).toBe('3');
      expect(result.answers[3].questionNumber).toBe('4');
    });

    it('should throw error for empty document', async () => {
      // Mock empty Textract response
      mockSend.mockResolvedValue({
        Blocks: [],
      });

      await expect(
        recognizer.extractHandwrittenAnswers(
          's3://test-bucket/submission.pdf',
          examStructure,
          'customer-123'
        )
      ).rejects.toThrow('No content extracted from submission');
    });

    it('should throw error for document with no text', async () => {
      // Mock Textract response with no LINE blocks
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'PAGE',
            Confidence: 100,
          },
        ],
      });

      await expect(
        recognizer.extractHandwrittenAnswers(
          's3://test-bucket/submission.pdf',
          examStructure,
          'customer-123'
        )
      ).rejects.toThrow('No text extracted from submission');
    });

    it('should handle access denied errors', async () => {
      // Mock access denied error
      mockSend.mockRejectedValue(new Error('Access Denied'));

      await expect(
        recognizer.extractHandwrittenAnswers(
          's3://test-bucket/submission.pdf',
          examStructure,
          'customer-123'
        )
      ).rejects.toThrow('Access denied to submission document');
    });

    it('should handle document not found errors', async () => {
      // Mock not found error
      mockSend.mockRejectedValue(new Error('Document does not exist'));

      await expect(
        recognizer.extractHandwrittenAnswers(
          's3://test-bucket/submission.pdf',
          examStructure,
          'customer-123'
        )
      ).rejects.toThrow('Submission document not found');
    });

    it('should handle invalid document format errors', async () => {
      // Mock invalid document error
      mockSend.mockRejectedValue(new Error('Invalid document format'));

      await expect(
        recognizer.extractHandwrittenAnswers(
          's3://test-bucket/submission.pdf',
          examStructure,
          'customer-123'
        )
      ).rejects.toThrow('Invalid submission document format');
    });

    it('should reject invalid S3 URLs', async () => {
      await expect(
        recognizer.extractHandwrittenAnswers(
          'invalid-url',
          examStructure,
          'customer-123'
        )
      ).rejects.toThrow('Invalid S3 URL format');
    });

    it('should expand bounding box for multi-line answers', async () => {
      // Mock Textract response with multi-line answer
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'LINE',
            Text: '1. First line of answer',
            Confidence: 95,
            Geometry: {
              BoundingBox: { Top: 0.1, Left: 0.1, Width: 0.3, Height: 0.05 },
            },
            Page: 1,
          },
          {
            BlockType: 'LINE',
            Text: 'Second line of answer',
            Confidence: 90,
            Geometry: {
              BoundingBox: { Top: 0.16, Left: 0.1, Width: 0.4, Height: 0.05 },
            },
            Page: 1,
          },
        ],
      });

      const result = await recognizer.extractHandwrittenAnswers(
        's3://test-bucket/submission.pdf',
        examStructure,
        'customer-123'
      );

      // Bounding box should encompass both lines
      const bbox = result.answers[0].boundingBox;
      expect(bbox.top).toBe(0.1);
      expect(bbox.height).toBeGreaterThan(0.05); // Should be expanded
    });
  });

  describe('getExtractionConfidence', () => {
    it('should calculate average confidence from LINE blocks', () => {
      const textractResponse = {
        Blocks: [
          { BlockType: 'LINE', Confidence: 90 },
          { BlockType: 'LINE', Confidence: 80 },
          { BlockType: 'LINE', Confidence: 70 },
          { BlockType: 'PAGE', Confidence: 100 }, // Should be ignored
        ],
      };

      const confidence = recognizer.getExtractionConfidence(textractResponse);
      expect(confidence).toBe(80); // (90 + 80 + 70) / 3 = 80
    });

    it('should return 0 for empty response', () => {
      const textractResponse = { Blocks: [] };
      const confidence = recognizer.getExtractionConfidence(textractResponse);
      expect(confidence).toBe(0);
    });

    it('should return 0 for response with no LINE blocks', () => {
      const textractResponse = {
        Blocks: [
          { BlockType: 'PAGE', Confidence: 100 },
          { BlockType: 'WORD', Confidence: 95 },
        ],
      };

      const confidence = recognizer.getExtractionConfidence(textractResponse);
      expect(confidence).toBe(0);
    });
  });
});
