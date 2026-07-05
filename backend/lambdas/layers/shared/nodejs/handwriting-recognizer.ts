/**
 * HandwritingRecognizer - Extracts handwritten text from student submissions
 * 
 * This class provides methods for:
 * - Extracting handwritten answers using AWS Textract
 * - Spatial analysis to map text blocks to question numbers
 * - Calculating confidence scores
 * - Flagging low-confidence answers for manual review
 * - Handling multi-page submissions
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import {
  ExtractedQuestionnaire,
  ExtractedAnswers,
  StudentAnswer,
  BoundingBox,
} from './exam-types';
import { withAWSRetry, logError, ErrorContext } from './error-handler';

export class HandwritingRecognizer {
  /**
   * Extracts handwritten answers from a student submission
   * 
   * @param documentUrl - S3 URL to the scanned submission
   * @param examStructure - The exam questionnaire structure for mapping
   * @param customerId - Customer identifier for multi-tenant isolation
   * @returns Extracted answers with confidence scores
   * 
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
   */
  async extractHandwrittenAnswers(
    documentUrl: string,
    examStructure: ExtractedQuestionnaire,
    customerId: string
  ): Promise<ExtractedAnswers> {
    const { TextractClient, AnalyzeDocumentCommand } = await import('@aws-sdk/client-textract');
    
    // Parse S3 URL to extract bucket and key
    const { bucket, key } = this.parseS3Url(documentUrl);
    
    // Initialize Textract client
    const textractClient = new TextractClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    
    // Error context for logging
    const errorContext: ErrorContext = {
      operation: 'extractHandwrittenAnswers',
      customerId,
      documentUrl,
    };
    
    try {
      // Call Textract AnalyzeDocument with retry logic
      const response = await withAWSRetry(
        async () => {
          const command = new AnalyzeDocumentCommand({
            Document: {
              S3Object: {
                Bucket: bucket,
                Name: key,
              },
            },
            // Use TABLES and FORMS features for better structure detection
            // Note: Textract doesn't have a specific "SIGNATURES" feature for handwriting
            // It automatically detects handwritten text in the document
            FeatureTypes: ['TABLES', 'FORMS'],
          });
          
          return await textractClient.send(command);
        },
        'Textract',
        errorContext,
        {
          maxRetries: 3,
          initialDelayMs: 1000,
        }
      );
      
      if (!response.Blocks || response.Blocks.length === 0) {
        throw new Error('No content extracted from submission. The document may be empty or unreadable.');
      }
      
      console.log(`[HandwritingRecognizer] Textract returned ${response.Blocks.length} blocks`);
      
      // Extract text blocks with spatial information
      const textBlocks = this.extractTextBlocks(response.Blocks);
      
      console.log(`[HandwritingRecognizer] Extracted ${textBlocks.length} text blocks`);
      if (textBlocks.length > 0) {
        console.log(`[HandwritingRecognizer] First 3 text blocks:`, 
          textBlocks.slice(0, 3).map(b => ({ text: b.text.substring(0, 50), confidence: b.confidence }))
        );
      }
      
      if (textBlocks.length === 0) {
        throw new Error('No text extracted from submission. The document may not contain readable handwriting.');
      }
      
      console.log(`[HandwritingRecognizer] Exam structure has ${examStructure.totalQuestions} questions across ${examStructure.sections.length} sections`);
      
      // Map text blocks to question numbers using spatial analysis
      const answers = this.mapTextBlocksToQuestions(textBlocks, examStructure);
      
      console.log(`[HandwritingRecognizer] Mapped ${answers.length} answers to questions`);
      if (answers.length > 0) {
        console.log(`[HandwritingRecognizer] Sample answers:`, 
          answers.slice(0, 2).map(a => ({ 
            questionNumber: a.questionNumber, 
            textPreview: a.extractedText.substring(0, 50),
            confidence: a.confidence 
          }))
        );
      }
      
      // Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(answers);
      
      // Flag answers with low confidence (<50%)
      const flaggedForReview = answers
        .filter(answer => answer.confidence < 50)
        .map(answer => answer.questionNumber);
      
      // Extract student ID from the document (if present)
      // For now, we'll use a placeholder - this would need to be enhanced
      // to actually detect student ID from the document
      const studentId = this.extractStudentId(textBlocks);
      
      return {
        studentId,
        answers,
        overallConfidence,
        flaggedForReview,
      };
    } catch (error) {
      // Log the error with context
      logError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Handle specific AWS errors
        if (errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
          throw new Error(`Access denied to submission document at ${documentUrl}. Please check S3 bucket permissions.`);
        }
        
        if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
          throw new Error(`Submission document not found at ${documentUrl}. Please verify the S3 URL is correct.`);
        }
        
        if (errorMessage.includes('invalid') && errorMessage.includes('document')) {
          throw new Error(`Invalid submission document format. The document may be corrupted or in an unsupported format.`);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Gets extraction confidence from Textract response
   * 
   * @param textractResponse - Raw Textract API response
   * @returns Confidence score between 0 and 100
   * 
   * Requirement: 4.3 - Achieve 80% or higher accuracy
   */
  getExtractionConfidence(textractResponse: any): number {
    if (!textractResponse.Blocks || textractResponse.Blocks.length === 0) {
      return 0;
    }
    
    let totalConfidence = 0;
    let blockCount = 0;
    
    for (const block of textractResponse.Blocks) {
      if (block.BlockType === 'LINE' && block.Confidence !== undefined) {
        totalConfidence += block.Confidence;
        blockCount++;
      }
    }
    
    if (blockCount === 0) {
      return 0;
    }
    
    const averageConfidence = totalConfidence / blockCount;
    return Math.round(averageConfidence * 100) / 100;
  }
  
  /**
   * Parses S3 URL to extract bucket and key
   * 
   * @param s3Url - S3 URL in format s3://bucket/key
   * @returns Object with bucket and key
   */
  private parseS3Url(s3Url: string): { bucket: string; key: string } {
    if (!s3Url.startsWith('s3://')) {
      throw new Error('Invalid S3 URL format. Expected s3://bucket/key');
    }
    
    const urlWithoutProtocol = s3Url.substring(5);
    const firstSlashIndex = urlWithoutProtocol.indexOf('/');
    
    if (firstSlashIndex === -1) {
      throw new Error('Invalid S3 URL format. Expected s3://bucket/key');
    }
    
    const bucket = urlWithoutProtocol.substring(0, firstSlashIndex);
    const key = urlWithoutProtocol.substring(firstSlashIndex + 1);
    
    if (!bucket || !key) {
      throw new Error('Invalid S3 URL format. Bucket and key cannot be empty');
    }
    
    return { bucket, key };
  }
  
  /**
   * Extracts text blocks with spatial information from Textract response
   * 
   * @param blocks - Textract response blocks
   * @returns Array of text blocks with bounding boxes and confidence
   */
  private extractTextBlocks(blocks: any[]): Array<{
    text: string;
    confidence: number;
    boundingBox: BoundingBox;
    page: number;
  }> {
    const textBlocks: Array<{
      text: string;
      confidence: number;
      boundingBox: BoundingBox;
      page: number;
    }> = [];
    
    for (const block of blocks) {
      if (block.BlockType === 'LINE' && block.Text && block.Geometry) {
        const bbox = block.Geometry.BoundingBox;
        
        textBlocks.push({
          text: block.Text.trim(),
          confidence: block.Confidence || 0,
          boundingBox: {
            top: bbox.Top || 0,
            left: bbox.Left || 0,
            width: bbox.Width || 0,
            height: bbox.Height || 0,
          },
          page: block.Page || 1,
        });
      }
    }
    
    return textBlocks;
  }
  
  /**
   * Maps text blocks to question numbers using spatial analysis
   * 
   * This implements a heuristic approach:
   * 1. Sort text blocks by page and vertical position (top to bottom)
   * 2. Look for question number markers in the text
   * 3. Group subsequent text blocks with the current question until next marker
   * 4. FALLBACK: If no markers found, divide text evenly across questions
   * 
   * @param textBlocks - Array of text blocks with spatial information
   * @param examStructure - The exam questionnaire structure
   * @returns Array of student answers mapped to questions
   * 
   * Requirement: 4.4 - Associate extracted text with question numbers
   */
  private mapTextBlocksToQuestions(
    textBlocks: Array<{
      text: string;
      confidence: number;
      boundingBox: BoundingBox;
      page: number;
    }>,
    examStructure: ExtractedQuestionnaire
  ): StudentAnswer[] {
    // Sort blocks by page, then by vertical position (top to bottom)
    const sortedBlocks = textBlocks.sort((a, b) => {
      if (a.page !== b.page) {
        return a.page - b.page;
      }
      return a.boundingBox.top - b.boundingBox.top;
    });
    
    const answers: StudentAnswer[] = [];
    let currentQuestionNumber: string | null = null;
    let currentAnswerText = '';
    let currentConfidences: number[] = [];
    let currentBoundingBox: BoundingBox | null = null;
    
    // Get all question numbers from exam structure
    const questionNumbers = new Set<string>();
    const orderedQuestionNumbers: string[] = [];
    for (const section of examStructure.sections) {
      for (const question of section.questions) {
        questionNumbers.add(question.questionNumber);
        orderedQuestionNumbers.push(question.questionNumber);
      }
    }
    
    console.log(`[HandwritingRecognizer] Looking for question markers among ${sortedBlocks.length} text blocks`);
    console.log(`[HandwritingRecognizer] Expected question numbers:`, Array.from(questionNumbers));
    
    // First pass: try to find question markers
    let markersFound = 0;
    for (const block of sortedBlocks) {
      const questionMatch = this.matchQuestionMarker(block.text);
      if (questionMatch && questionNumbers.has(questionMatch)) {
        markersFound++;
      }
    }
    
    console.log(`[HandwritingRecognizer] Found ${markersFound} question markers`);
    
    // If we found markers, use marker-based mapping
    if (markersFound > 0) {
      for (const block of sortedBlocks) {
        // Check if this block starts with a question number
        const questionMatch = this.matchQuestionMarker(block.text);
        
        if (questionMatch && questionNumbers.has(questionMatch)) {
          // Save previous answer if exists
          if (currentQuestionNumber && currentAnswerText.trim()) {
            const avgConfidence = currentConfidences.length > 0
              ? currentConfidences.reduce((sum, c) => sum + c, 0) / currentConfidences.length
              : 0;
            
            answers.push({
              questionNumber: currentQuestionNumber,
              extractedText: currentAnswerText.trim(),
              confidence: Math.round(avgConfidence * 100) / 100,
              boundingBox: currentBoundingBox || { top: 0, left: 0, width: 0, height: 0 },
            });
          }
          
          // Start new answer
          currentQuestionNumber = questionMatch;
          currentAnswerText = block.text.replace(/^[\d.)\s]+/, '').trim(); // Remove question number prefix
          currentConfidences = [block.confidence];
          currentBoundingBox = block.boundingBox;
        } else if (currentQuestionNumber) {
          // Continue current answer
          currentAnswerText += ' ' + block.text;
          currentConfidences.push(block.confidence);
          
          // Expand bounding box to include this block
          if (currentBoundingBox) {
            const bottom: number = currentBoundingBox.top + currentBoundingBox.height;
            const right: number = currentBoundingBox.left + currentBoundingBox.width;
            const blockBottom = block.boundingBox.top + block.boundingBox.height;
            const blockRight = block.boundingBox.left + block.boundingBox.width;
            
            currentBoundingBox = {
              top: Math.min(currentBoundingBox.top, block.boundingBox.top),
              left: Math.min(currentBoundingBox.left, block.boundingBox.left),
              width: Math.max(right, blockRight) - Math.min(currentBoundingBox.left, block.boundingBox.left),
              height: Math.max(bottom, blockBottom) - Math.min(currentBoundingBox.top, block.boundingBox.top),
            };
          }
        }
      }
      
      // Save last answer if exists
      if (currentQuestionNumber && currentAnswerText.trim()) {
        const avgConfidence = currentConfidences.length > 0
          ? currentConfidences.reduce((sum, c) => sum + c, 0) / currentConfidences.length
          : 0;
        
        answers.push({
          questionNumber: currentQuestionNumber,
          extractedText: currentAnswerText.trim(),
          confidence: Math.round(avgConfidence * 100) / 100,
          boundingBox: currentBoundingBox || { top: 0, left: 0, width: 0, height: 0 },
        });
      }
    } else {
      // FALLBACK: No markers found, use sequential assignment
      console.log(`[HandwritingRecognizer] No question markers found, using sequential assignment fallback`);
      
      // Filter out header/metadata text (first few lines often contain school name, student info, etc.)
      const contentBlocks = sortedBlocks.filter(block => {
        const lowerText = block.text.toLowerCase();
        // Skip common header patterns
        return !lowerText.includes('name:') &&
               !lowerText.includes('date:') &&
               !lowerText.includes('grade:') &&
               !lowerText.includes('school') &&
               !lowerText.includes('institution') &&
               !lowerText.includes('exam') &&
               block.text.length > 10; // Skip very short lines
      });
      
      console.log(`[HandwritingRecognizer] After filtering headers: ${contentBlocks.length} content blocks`);
      
      if (contentBlocks.length === 0) {
        console.warn(`[HandwritingRecognizer] No content blocks found after filtering`);
        return answers;
      }
      
      // Divide blocks evenly across questions
      const blocksPerQuestion = Math.ceil(contentBlocks.length / orderedQuestionNumbers.length);
      console.log(`[HandwritingRecognizer] Assigning ~${blocksPerQuestion} blocks per question`);
      
      for (let i = 0; i < orderedQuestionNumbers.length; i++) {
        const questionNumber = orderedQuestionNumbers[i];
        const startIdx = i * blocksPerQuestion;
        const endIdx = Math.min((i + 1) * blocksPerQuestion, contentBlocks.length);
        const questionBlocks = contentBlocks.slice(startIdx, endIdx);
        
        if (questionBlocks.length === 0) continue;
        
        const answerText = questionBlocks.map(b => b.text).join(' ');
        const avgConfidence = questionBlocks.reduce((sum, b) => sum + b.confidence, 0) / questionBlocks.length;
        
        // Calculate bounding box that encompasses all blocks
        let minTop = questionBlocks[0].boundingBox.top;
        let minLeft = questionBlocks[0].boundingBox.left;
        let maxBottom = questionBlocks[0].boundingBox.top + questionBlocks[0].boundingBox.height;
        let maxRight = questionBlocks[0].boundingBox.left + questionBlocks[0].boundingBox.width;
        
        for (const block of questionBlocks) {
          minTop = Math.min(minTop, block.boundingBox.top);
          minLeft = Math.min(minLeft, block.boundingBox.left);
          maxBottom = Math.max(maxBottom, block.boundingBox.top + block.boundingBox.height);
          maxRight = Math.max(maxRight, block.boundingBox.left + block.boundingBox.width);
        }
        
        answers.push({
          questionNumber,
          extractedText: answerText.trim(),
          confidence: Math.round(avgConfidence * 100) / 100,
          boundingBox: {
            top: minTop,
            left: minLeft,
            width: maxRight - minLeft,
            height: maxBottom - minTop,
          },
        });
        
        console.log(`[HandwritingRecognizer] Q${questionNumber}: ${questionBlocks.length} blocks, ${answerText.length} chars`);
      }
    }
    
    return answers;
  }
  
  /**
   * Matches question number markers in text
   * Supports various formats: "1.", "1)", "Q1", etc.
   * 
   * @param text - Text to check for question markers
   * @returns Question number if found, null otherwise
   */
  private matchQuestionMarker(text: string): string | null {
    const patterns = [
      /^(\d+)[.)]\s*/,           // "1." or "1)"
      /^(\d+[a-z])[.)]\s*/i,     // "1a." or "1a)"
      /^(\d+\.\d+)\.?\s*/,       // "1.1" or "1.1."
      /^[Qq](\d+)[.)]\s*/,       // "Q1." or "Q1)"
      /^\((\d+)\)\s*/,           // "(1)"
      /^(\d+)-\s*/,              // "1-"
      /^(\d+):\s*/,              // "1:"
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }
  
  /**
   * Calculates overall confidence from all answers
   * 
   * @param answers - Array of student answers
   * @returns Overall confidence score
   */
  private calculateOverallConfidence(answers: StudentAnswer[]): number {
    if (answers.length === 0) {
      return 0;
    }
    
    const totalConfidence = answers.reduce((sum, answer) => sum + answer.confidence, 0);
    const avgConfidence = totalConfidence / answers.length;
    
    return Math.round(avgConfidence * 100) / 100;
  }
  
  /**
   * Extracts student ID from text blocks
   * 
   * This is a simple implementation that looks for common patterns.
   * In a real system, this would be more sophisticated.
   * 
   * @param textBlocks - Array of text blocks
   * @returns Student ID or 'UNKNOWN'
   */
  private extractStudentId(textBlocks: Array<{ text: string }>): string {
    const patterns = [
      /student\s*id\s*:?\s*(\w+)/i,
      /id\s*:?\s*(\w+)/i,
      /student\s*#\s*:?\s*(\w+)/i,
      /student\s*number\s*:?\s*(\w+)/i,
    ];
    
    for (const block of textBlocks) {
      for (const pattern of patterns) {
        const match = block.text.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }
    
    return 'UNKNOWN';
  }
}
