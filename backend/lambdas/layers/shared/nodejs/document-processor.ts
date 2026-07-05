/**
 * DocumentProcessor - Handles document format validation and text extraction
 * 
 * This class provides methods for:
 * - Validating document formats using magic number detection
 * - Extracting questions from exam questionnaires
 * - Extracting answer key mappings
 * 
 * Supports: PDF, DOCX, PNG, JPG formats
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { DocumentFormat, ExtractedQuestionnaire, AnswerKeyMapping, Section, Question } from './exam-types';
import { withAWSRetry, logError, ErrorContext, ErrorType } from './error-handler';

/**
 * Magic number signatures for supported file formats
 * These are the first few bytes that identify file types
 */
const FILE_SIGNATURES = {
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
  PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG signature
  JPG: [0xFF, 0xD8, 0xFF], // JPEG/JPG signature
  DOCX: [0x50, 0x4B, 0x03, 0x04], // ZIP signature (DOCX is a ZIP archive)
} as const;

/**
 * Additional DOCX validation - check for specific content
 * DOCX files contain specific XML files in their ZIP structure
 */
const DOCX_CONTENT_MARKERS = [
  'word/', // DOCX contains word/ directory
  'document.xml', // Main document file
  '[Content_Types].xml', // Content types file
];

export interface FormatValidationResult {
  isValid: boolean;
  detectedFormat?: DocumentFormat;
  errorMessage?: string;
}

export class DocumentProcessor {
  /**
   * Validates document format by checking file signatures (magic numbers)
   * 
   * @param fileBuffer - Buffer containing the file data
   * @param expectedFormat - The format we expect the file to be
   * @returns boolean indicating if the file matches the expected format
   * 
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
   */
  validateDocumentFormat(
    fileBuffer: Buffer,
    expectedFormat: DocumentFormat
  ): boolean {
    const result = this.detectDocumentFormat(fileBuffer);
    
    if (!result.isValid) {
      return false;
    }
    
    // For IMAGE format, accept both PNG and JPG
    if (expectedFormat === 'IMAGE') {
      return result.detectedFormat === 'IMAGE';
    }
    
    return result.detectedFormat === expectedFormat;
  }

  /**
   * Detects the document format by analyzing file signatures
   * 
   * @param fileBuffer - Buffer containing the file data
   * @returns FormatValidationResult with detection details
   */
  detectDocumentFormat(fileBuffer: Buffer): FormatValidationResult {
    if (!fileBuffer || fileBuffer.length === 0) {
      return {
        isValid: false,
        errorMessage: 'File buffer is empty or invalid',
      };
    }

    // Check for PDF
    if (this.matchesSignature(fileBuffer, FILE_SIGNATURES.PDF)) {
      return {
        isValid: true,
        detectedFormat: 'PDF',
      };
    }

    // Check for PNG
    if (this.matchesSignature(fileBuffer, FILE_SIGNATURES.PNG)) {
      return {
        isValid: true,
        detectedFormat: 'IMAGE',
      };
    }

    // Check for JPG
    if (this.matchesSignature(fileBuffer, FILE_SIGNATURES.JPG)) {
      return {
        isValid: true,
        detectedFormat: 'IMAGE',
      };
    }

    // Check for DOCX (ZIP-based format)
    if (this.matchesSignature(fileBuffer, FILE_SIGNATURES.DOCX)) {
      // Additional validation for DOCX
      if (this.isLikelyDocx(fileBuffer)) {
        return {
          isValid: true,
          detectedFormat: 'DOCX',
        };
      }
      // It's a ZIP file but not a DOCX
      return {
        isValid: false,
        errorMessage: 'Unsupported file format. File appears to be a ZIP archive but not a valid DOCX document. Please upload PDF, DOCX, PNG, or JPG files.',
      };
    }

    // Unknown format
    return {
      isValid: false,
      errorMessage: 'Unsupported file format. Please upload PDF, DOCX, PNG, or JPG files.',
    };
  }

  /**
   * Checks if a buffer matches a specific file signature
   * 
   * @param buffer - File buffer to check
   * @param signature - Expected signature bytes
   * @returns true if the buffer starts with the signature
   */
  private matchesSignature(buffer: Buffer, signature: readonly number[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Additional validation to distinguish DOCX from other ZIP files
   * Checks for DOCX-specific content markers in the ZIP structure
   * 
   * @param buffer - File buffer to check
   * @returns true if the file is likely a DOCX document
   */
  private isLikelyDocx(buffer: Buffer): boolean {
    // Convert buffer to string for content checking
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    
    // Check for DOCX-specific markers
    let markerCount = 0;
    for (const marker of DOCX_CONTENT_MARKERS) {
      if (content.includes(marker)) {
        markerCount++;
      }
    }
    
    // If we find at least 2 DOCX markers, it's likely a DOCX file
    return markerCount >= 2;
  }

  /**
   * Gets a user-friendly error message for format validation failures
   * 
   * @param fileBuffer - Buffer containing the file data
   * @returns Clear error message for the user
   * 
   * Requirement: 1.6 - Provide clear error messages for unsupported formats
   */
  getFormatErrorMessage(fileBuffer: Buffer): string {
    const result = this.detectDocumentFormat(fileBuffer);
    
    if (result.isValid) {
      return ''; // No error
    }
    
    return result.errorMessage || 'Unsupported file format. Please upload PDF, DOCX, PNG, or JPG files.';
  }

  /**
   * Extracts questions from an exam questionnaire document
   * 
   * @param documentUrl - S3 URL or path to the document
   * @param customerId - Customer identifier for multi-tenant isolation
   * @returns Extracted questionnaire with sections and questions
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
   */
  async extractQuestionsFromQuestionnaire(
    documentUrl: string,
    customerId: string
  ): Promise<ExtractedQuestionnaire> {
    const { TextractClient, AnalyzeDocumentCommand } = await import('@aws-sdk/client-textract');
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    
    // Parse S3 URL to extract bucket and key
    const { bucket, key } = this.parseS3Url(documentUrl);
    
    // Initialize Textract client
    const textractClient = new TextractClient({ region: process.env.AWS_REGION || 'us-east-1' });
    
    // Retry configuration
    const maxRetries = 2;
    let lastError: Error | null = null;
    let partialResult: ExtractedQuestionnaire | null = null;
    
    // Try with TABLES and FORMS features first, then retry with just TABLES if it fails
    const featureConfigurations = [
      ['TABLES', 'FORMS'],
      ['TABLES'],
    ];
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const featureTypes = featureConfigurations[attempt] || ['TABLES'];
        
        // Call Textract AnalyzeDocument
        const command = new AnalyzeDocumentCommand({
          Document: {
            S3Object: {
              Bucket: bucket,
              Name: key,
            },
          },
          FeatureTypes: featureTypes as any,
        });
        
        const response = await textractClient.send(command);
        
        if (!response.Blocks || response.Blocks.length === 0) {
          lastError = new Error('No content extracted from document. The document may be empty or unreadable.');
          continue;
        }
        
        // Extract text lines from Textract response
        const lines = this.extractTextLines(response.Blocks);
        
        if (lines.length === 0) {
          lastError = new Error('No text lines extracted from document. The document may not contain readable text.');
          continue;
        }
        
        // Parse questions and sections from extracted lines
        const { sections, totalQuestions } = this.parseQuestionsAndSections(lines);
        
        // Store partial result if we extracted at least some questions
        if (totalQuestions > 0) {
          const extractionConfidence = this.calculateExtractionConfidence(response.Blocks, totalQuestions);
          
          partialResult = {
            sections,
            totalQuestions,
            extractionConfidence,
          };
          
          // If we got a good result, return it
          return partialResult;
        } else {
          lastError = new Error('No questions detected in document. Please ensure the document contains numbered questions (e.g., "1. Question text").');
          // Continue to retry with different feature configuration
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error during extraction');
        
        // Check for specific AWS errors
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          
          // Throttling error - wait and retry
          if (errorMessage.includes('throttl') || errorMessage.includes('rate')) {
            await this.sleep(1000 * (attempt + 1)); // Exponential backoff
            continue;
          }
          
          // Access denied - don't retry
          if (errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
            throw new Error(`Access denied to document at ${documentUrl}. Please check S3 bucket permissions.`);
          }
          
          // Document not found - don't retry
          if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`Document not found at ${documentUrl}. Please verify the S3 URL is correct.`);
          }
          
          // Invalid document format - don't retry
          if (errorMessage.includes('invalid') && errorMessage.includes('document')) {
            throw new Error(`Invalid document format. The document may be corrupted or in an unsupported format.`);
          }
        }
        
        // For other errors, continue to retry
        if (attempt < maxRetries - 1) {
          await this.sleep(500 * (attempt + 1)); // Brief delay before retry
        }
      }
    }
    
    // If we have partial results, return them with a warning
    if (partialResult && partialResult.totalQuestions > 0) {
      console.warn(`Extraction completed with partial results. ${partialResult.totalQuestions} questions extracted.`);
      return partialResult;
    }
    
    // All retries failed - throw diagnostic error
    const diagnosticMessage = this.buildDiagnosticErrorMessage(lastError, documentUrl);
    throw new Error(diagnosticMessage);
  }
  
  /**
   * Builds a diagnostic error message with actionable guidance
   * 
   * @param error - The last error encountered
   * @param documentUrl - The document URL that failed
   * @returns Diagnostic error message
   * 
   * Requirement: 2.6 - Provide diagnostic information about failures
   */
  private buildDiagnosticErrorMessage(error: Error | null, documentUrl: string): string {
    const baseMessage = 'Failed to extract questions from questionnaire';
    
    if (!error) {
      return `${baseMessage}. Unknown error occurred while processing ${documentUrl}.`;
    }
    
    const errorMessage = error.message.toLowerCase();
    
    // Provide specific guidance based on error type
    if (errorMessage.includes('no content') || errorMessage.includes('empty')) {
      return `${baseMessage}: The document appears to be empty or contains no readable content. Please verify the document is not blank and try again.`;
    }
    
    if (errorMessage.includes('no text lines')) {
      return `${baseMessage}: Unable to extract text from the document. The document may be an image without OCR, or the text may be embedded in a way that cannot be extracted. Try converting the document to a standard PDF format.`;
    }
    
    if (errorMessage.includes('no questions detected')) {
      return `${baseMessage}: No questions were detected in the document. Please ensure questions are numbered (e.g., "1. Question text", "Q1:", "Question 1:"). If questions exist but weren't detected, you may need to manually enter them.`;
    }
    
    if (errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
      return `${baseMessage}: Access denied to the document. Please verify that the S3 bucket permissions allow Textract to read the document.`;
    }
    
    if (errorMessage.includes('not found')) {
      return `${baseMessage}: Document not found at the specified location. Please verify the S3 URL is correct and the document exists.`;
    }
    
    if (errorMessage.includes('invalid') || errorMessage.includes('corrupt')) {
      return `${baseMessage}: The document appears to be corrupted or in an invalid format. Try re-scanning or re-saving the document and uploading again.`;
    }
    
    if (errorMessage.includes('throttl') || errorMessage.includes('rate')) {
      return `${baseMessage}: Service rate limit exceeded. Please wait a moment and try again.`;
    }
    
    // Generic error with the original message
    return `${baseMessage}: ${error.message}. Please verify the document is a valid PDF or DOCX file with readable text and numbered questions.`;
  }
  
  /**
   * Sleep utility for retry delays
   * 
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extracts answer key mappings from an answer key document
   * 
   * @param documentUrl - S3 URL or path to the document
   * @param customerId - Customer identifier for multi-tenant isolation
   * @returns Array of question-answer mappings
   * 
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async extractAnswerKeyMappings(
    documentUrl: string,
    customerId: string
  ): Promise<AnswerKeyMapping[]> {
    const { TextractClient, AnalyzeDocumentCommand } = await import('@aws-sdk/client-textract');
    
    // Parse S3 URL to extract bucket and key
    const { bucket, key } = this.parseS3Url(documentUrl);
    
    // Initialize Textract client
    const textractClient = new TextractClient({ region: process.env.AWS_REGION || 'us-east-1' });
    
    // Retry configuration
    const maxRetries = 2;
    let lastError: Error | null = null;
    let partialResult: AnswerKeyMapping[] | null = null;
    
    // Try with TABLES and FORMS features first, then retry with just TABLES if it fails
    const featureConfigurations = [
      ['TABLES', 'FORMS'],
      ['TABLES'],
    ];
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const featureTypes = featureConfigurations[attempt] || ['TABLES'];
        
        // Call Textract AnalyzeDocument
        const command = new AnalyzeDocumentCommand({
          Document: {
            S3Object: {
              Bucket: bucket,
              Name: key,
            },
          },
          FeatureTypes: featureTypes as any,
        });
        
        const response = await textractClient.send(command);
        
        if (!response.Blocks || response.Blocks.length === 0) {
          lastError = new Error('No content extracted from answer key document. The document may be empty or unreadable.');
          continue;
        }
        
        // Extract text lines from Textract response
        const lines = this.extractTextLines(response.Blocks);
        
        if (lines.length === 0) {
          lastError = new Error('No text lines extracted from answer key document. The document may not contain readable text.');
          continue;
        }
        
        // Parse answer key mappings from extracted lines
        const answerMappings = this.parseAnswerKeyMappings(lines);
        
        // Store partial result if we extracted at least some answers
        if (answerMappings.length > 0) {
          partialResult = answerMappings;
          
          // If we got a good result, return it
          return partialResult;
        } else {
          lastError = new Error('No answer key mappings detected in document. Please ensure the document contains question-answer pairs (e.g., "1. Answer text" or "Q1: Answer text").');
          // Continue to retry with different feature configuration
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error during answer key extraction');
        
        // Check for specific AWS errors
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          
          // Throttling error - wait and retry
          if (errorMessage.includes('throttl') || errorMessage.includes('rate')) {
            await this.sleep(1000 * (attempt + 1)); // Exponential backoff
            continue;
          }
          
          // Access denied - don't retry
          if (errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
            throw new Error(`Access denied to answer key document at ${documentUrl}. Please check S3 bucket permissions.`);
          }
          
          // Document not found - don't retry
          if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
            throw new Error(`Answer key document not found at ${documentUrl}. Please verify the S3 URL is correct.`);
          }
          
          // Invalid document format - don't retry
          if (errorMessage.includes('invalid') && errorMessage.includes('document')) {
            throw new Error(`Invalid answer key document format. The document may be corrupted or in an unsupported format.`);
          }
        }
        
        // For other errors, continue to retry
        if (attempt < maxRetries - 1) {
          await this.sleep(500 * (attempt + 1)); // Brief delay before retry
        }
      }
    }
    
    // If we have partial results, return them with a warning
    if (partialResult && partialResult.length > 0) {
      console.warn(`Answer key extraction completed with partial results. ${partialResult.length} answer mappings extracted.`);
      return partialResult;
    }
    
    // All retries failed - throw diagnostic error
    const diagnosticMessage = this.buildAnswerKeyDiagnosticErrorMessage(lastError, documentUrl);
    throw new Error(diagnosticMessage);
  }
  
  /**
   * Parses answer key mappings from extracted text lines
   * Implements heuristics to detect question-answer pairs
   * 
   * @param lines - Array of text lines from document
   * @returns Array of answer key mappings
   */
  private parseAnswerKeyMappings(lines: string[]): AnswerKeyMapping[] {
    const answerMappings: AnswerKeyMapping[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line starts with a question number pattern
      const answerMatch = this.matchAnswerKeyEntry(line);
      if (answerMatch) {
        // Extract answer text (may span multiple lines)
        let answerText = answerMatch.answer;
        let j = i + 1;
        
        // Look ahead for continuation lines (lines that don't start with question numbers)
        while (j < lines.length && !this.matchAnswerKeyEntry(lines[j])) {
          const nextLine = lines[j].trim();
          if (nextLine) {
            answerText += ' ' + nextLine;
          }
          j++;
        }
        
        // Extract keywords from the answer
        const keywords = this.extractKeywords(answerText);
        
        // Create answer key mapping
        const mapping: AnswerKeyMapping = {
          questionNumber: answerMatch.number,
          expectedAnswer: answerText.trim(),
          keywords: keywords,
        };
        
        answerMappings.push(mapping);
        
        // Skip the lines we've already processed
        i = j - 1;
      }
    }
    
    return answerMappings;
  }
  
  /**
   * Matches answer key entry patterns in text
   * Supports various formats: "1. Answer", "Q1: Answer", "Answer 1: Answer", etc.
   * 
   * @param line - Text line to check
   * @returns Match object with question number and answer text, or null if not an answer entry
   */
  private matchAnswerKeyEntry(line: string): { number: string; answer: string } | null {
    const patterns = [
      // Pattern: "1. Answer text" or "1) Answer text"
      /^(\d+)[.)]\s+(.+)/,
      // Pattern: "1a. Answer text" or "1a) Answer text"
      /^(\d+[a-z])[.)]\s+(.+)/i,
      // Pattern: "1.1 Answer text" or "1.1. Answer text"
      /^(\d+\.\d+)\.?\s+(.+)/,
      // Pattern: "Q1. Answer text" or "Q1) Answer text" or "Q1: Answer text"
      /^[Qq](\d+)[.):]\s+(.+)/,
      // Pattern: "Question 1: Answer text" or "Question 1. Answer text"
      /^[Qq]uestion\s+(\d+)[:.]\s+(.+)/i,
      // Pattern: "Answer 1: Answer text" or "Answer 1. Answer text"
      /^[Aa]nswer\s+(\d+)[:.]\s+(.+)/i,
      // Pattern: "(1) Answer text"
      /^\((\d+)\)\s+(.+)/,
      // Pattern: "1- Answer text"
      /^(\d+)-\s+(.+)/,
      // Pattern: "1: Answer text"
      /^(\d+):\s+(.+)/,
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          number: match[1],
          answer: match[2].trim(),
        };
      }
    }
    
    return null;
  }
  
  /**
   * Extracts keywords from answer text
   * Uses simple heuristics to identify important words
   * 
   * @param answerText - The expected answer text
   * @returns Array of keywords
   */
  private extractKeywords(answerText: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'this', 'these', 'those', 'they',
      'their', 'them', 'there', 'which', 'who', 'what', 'when', 'where',
      'why', 'how', 'can', 'could', 'should', 'would', 'may', 'might',
      'must', 'shall', 'will', 'do', 'does', 'did', 'have', 'had',
    ]);
    
    // Split into words and clean
    const words = answerText
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2) // Keep words longer than 2 characters
      .filter(word => !stopWords.has(word)); // Remove stop words
    
    // Remove duplicates and return
    return Array.from(new Set(words));
  }
  
  /**
   * Builds a diagnostic error message for answer key extraction failures
   * 
   * @param error - The last error encountered
   * @param documentUrl - The document URL that failed
   * @returns Diagnostic error message
   */
  private buildAnswerKeyDiagnosticErrorMessage(error: Error | null, documentUrl: string): string {
    const baseMessage = 'Failed to extract answer key mappings';
    
    if (!error) {
      return `${baseMessage}. Unknown error occurred while processing ${documentUrl}.`;
    }
    
    const errorMessage = error.message.toLowerCase();
    
    // Provide specific guidance based on error type
    if (errorMessage.includes('no content') || errorMessage.includes('empty')) {
      return `${baseMessage}: The answer key document appears to be empty or contains no readable content. Please verify the document is not blank and try again.`;
    }
    
    if (errorMessage.includes('no text lines')) {
      return `${baseMessage}: Unable to extract text from the answer key document. The document may be an image without OCR, or the text may be embedded in a way that cannot be extracted. Try converting the document to a standard PDF format.`;
    }
    
    if (errorMessage.includes('no answer key mappings')) {
      return `${baseMessage}: No answer key mappings were detected in the document. Please ensure answers are numbered to match questions (e.g., "1. Answer text", "Q1: Answer text", "Answer 1: Answer text"). If answers exist but weren't detected, you may need to manually enter them.`;
    }
    
    if (errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
      return `${baseMessage}: Access denied to the answer key document. Please verify that the S3 bucket permissions allow Textract to read the document.`;
    }
    
    if (errorMessage.includes('not found')) {
      return `${baseMessage}: Answer key document not found at the specified location. Please verify the S3 URL is correct and the document exists.`;
    }
    
    if (errorMessage.includes('invalid') || errorMessage.includes('corrupt')) {
      return `${baseMessage}: The answer key document appears to be corrupted or in an invalid format. Try re-scanning or re-saving the document and uploading again.`;
    }
    
    if (errorMessage.includes('throttl') || errorMessage.includes('rate')) {
      return `${baseMessage}: Service rate limit exceeded. Please wait a moment and try again.`;
    }
    
    // Generic error with the original message
    return `${baseMessage}: ${error.message}. Please verify the document is a valid PDF or DOCX file with readable text and numbered answers.`;
  }

  /**
   * Parses S3 URL to extract bucket and key
   * 
   * @param s3Url - S3 URL in format s3://bucket/key or s3://bucket/path/to/key
   * @returns Object with bucket and key
   */
  private parseS3Url(s3Url: string): { bucket: string; key: string } {
    if (!s3Url.startsWith('s3://')) {
      throw new Error('Invalid S3 URL format. Expected s3://bucket/key');
    }
    
    const urlWithoutProtocol = s3Url.substring(5); // Remove 's3://'
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
   * Extracts text lines from Textract blocks
   * 
   * @param blocks - Textract response blocks
   * @returns Array of text lines in document order
   */
  private extractTextLines(blocks: any[]): string[] {
    const lines: string[] = [];
    
    for (const block of blocks) {
      if (block.BlockType === 'LINE' && block.Text) {
        lines.push(block.Text.trim());
      }
    }
    
    return lines;
  }

  /**
   * Parses questions and sections from extracted text lines
   * Implements heuristics to detect question boundaries and section headers
   * 
   * @param lines - Array of text lines from document
   * @returns Object with sections array and total question count
   */
  private parseQuestionsAndSections(lines: string[]): {
    sections: Section[];
    totalQuestions: number;
  } {
    const sections: Section[] = [];
    let currentSection: Section | null = null;
    let currentSectionNumber = 0;
    let totalQuestions = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line is a section header
      const sectionMatch = this.matchSectionHeader(line);
      if (sectionMatch) {
        // Save previous section if exists
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Create new section
        currentSectionNumber++;
        currentSection = {
          sectionNumber: currentSectionNumber,
          sectionTitle: sectionMatch.title,
          questions: [],
        };
        continue;
      }
      
      // Check if line is a question
      const questionMatch = this.matchQuestion(line);
      if (questionMatch) {
        // If no section exists yet, create a default section
        if (!currentSection) {
          currentSectionNumber++;
          currentSection = {
            sectionNumber: currentSectionNumber,
            sectionTitle: 'General',
            questions: [],
          };
        }
        
        // Extract question text (may span multiple lines)
        let questionText = questionMatch.text;
        let j = i + 1;
        
        // Look ahead for continuation lines (lines that don't start with question numbers)
        while (j < lines.length && !this.matchQuestion(lines[j]) && !this.matchSectionHeader(lines[j])) {
          const nextLine = lines[j].trim();
          if (nextLine) {
            questionText += ' ' + nextLine;
          }
          j++;
        }
        
        // Extract points if present
        const points = this.extractPoints(questionText);
        
        // Create question object
        const question: Question = {
          questionNumber: questionMatch.number,
          questionText: questionText.trim(),
          points: points,
          sectionId: `section-${currentSectionNumber}`,
        };
        
        currentSection.questions.push(question);
        totalQuestions++;
        
        // Skip the lines we've already processed
        i = j - 1;
      }
    }
    
    // Add the last section if exists
    if (currentSection) {
      sections.push(currentSection);
    }
    
    // If no sections were found but we have questions, create a default section
    if (sections.length === 0 && totalQuestions === 0) {
      // Try to extract questions without strict section requirements
      const defaultSection: Section = {
        sectionNumber: 1,
        sectionTitle: 'General',
        questions: [],
      };
      
      for (const line of lines) {
        const questionMatch = this.matchQuestion(line);
        if (questionMatch) {
          defaultSection.questions.push({
            questionNumber: questionMatch.number,
            questionText: questionMatch.text,
            points: this.extractPoints(questionMatch.text),
            sectionId: 'section-1',
          });
          totalQuestions++;
        }
      }
      
      if (defaultSection.questions.length > 0) {
        sections.push(defaultSection);
      }
    }
    
    return { sections, totalQuestions };
  }

  /**
   * Matches section headers in text
   * Patterns: "Section 1:", "Part A:", "Section I -", etc.
   * 
   * @param line - Text line to check
   * @returns Match object with title, or null if not a section header
   */
  private matchSectionHeader(line: string): { title: string } | null {
    const patterns = [
      /^(Section\s+[IVXivx\d]+[\s:.-]+)(.+)/i,
      /^(Part\s+[A-Za-z\d]+[\s:.-]+)(.+)/i,
      /^(Chapter\s+[IVXivx\d]+[\s:.-]+)(.+)/i,
      /^([IVXivx]+\.\s+)(.+)/,
      /^([A-Z]\.\s+)(.+)/,
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return { title: line.trim() };
      }
    }
    
    return null;
  }

  /**
   * Matches question patterns in text
   * Supports various numbering patterns: 1, 1a, 1.1, Q1, Question 1, etc.
   * 
   * @param line - Text line to check
   * @returns Match object with question number and text, or null if not a question
   */
  private matchQuestion(line: string): { number: string; text: string } | null {
    const patterns = [
      // Pattern: "1. Question text" or "1) Question text"
      /^(\d+)[.)]\s+(.+)/,
      // Pattern: "1a. Question text" or "1a) Question text"
      /^(\d+[a-z])[.)]\s+(.+)/i,
      // Pattern: "1.1 Question text" or "1.1. Question text"
      /^(\d+\.\d+)\.?\s+(.+)/,
      // Pattern: "Q1. Question text" or "Q1) Question text"
      /^[Qq](\d+)[.)]\s+(.+)/,
      // Pattern: "Question 1: Question text" or "Question 1. Question text"
      /^[Qq]uestion\s+(\d+)[:.]\s+(.+)/i,
      // Pattern: "(1) Question text"
      /^\((\d+)\)\s+(.+)/,
      // Pattern: "1- Question text"
      /^(\d+)-\s+(.+)/,
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          number: match[1],
          text: match[2].trim(),
        };
      }
    }
    
    return null;
  }

  /**
   * Extracts point values from question text
   * Patterns: "(5 points)", "[10 pts]", "(5 marks)", etc.
   * 
   * @param text - Question text
   * @returns Point value, or 1 if not found
   */
  private extractPoints(text: string): number {
    const patterns = [
      /\((\d+)\s*(?:points?|pts?|marks?)\)/i,
      /\[(\d+)\s*(?:points?|pts?|marks?)\]/i,
      /(\d+)\s*(?:points?|pts?|marks?)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    // Default to 1 point if not specified
    return 1;
  }

  /**
   * Calculates extraction confidence based on Textract confidence scores
   * 
   * @param blocks - Textract response blocks
   * @param totalQuestions - Number of questions extracted
   * @returns Confidence score between 0 and 100
   */
  private calculateExtractionConfidence(blocks: any[], totalQuestions: number): number {
    if (totalQuestions === 0) {
      return 0;
    }
    
    // Calculate average confidence from LINE blocks
    let totalConfidence = 0;
    let lineCount = 0;
    
    for (const block of blocks) {
      if (block.BlockType === 'LINE' && block.Confidence !== undefined) {
        totalConfidence += block.Confidence;
        lineCount++;
      }
    }
    
    if (lineCount === 0) {
      return 50; // Default confidence if no confidence scores available
    }
    
    const averageConfidence = totalConfidence / lineCount;
    
    // Round to 2 decimal places
    return Math.round(averageConfidence * 100) / 100;
  }
}
