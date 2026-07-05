/**
 * Unit tests for DocumentProcessor class
 * 
 * Tests cover:
 * - Format validation for supported formats (PDF, DOCX, PNG, JPG)
 * - Format rejection for unsupported formats
 * - Error message generation
 * - Edge cases (empty buffers, corrupted files)
 */

import { DocumentProcessor } from './document-processor';

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;

  beforeEach(() => {
    processor = new DocumentProcessor();
  });

  describe('validateDocumentFormat', () => {
    describe('PDF format validation', () => {
      it('should accept valid PDF files', () => {
        // PDF signature: %PDF
        const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
        
        const result = processor.validateDocumentFormat(pdfBuffer, 'PDF');
        
        expect(result).toBe(true);
      });

      it('should reject non-PDF files when PDF is expected', () => {
        // PNG signature
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        
        const result = processor.validateDocumentFormat(pngBuffer, 'PDF');
        
        expect(result).toBe(false);
      });
    });

    describe('PNG format validation', () => {
      it('should accept valid PNG files', () => {
        // PNG signature
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        
        const result = processor.validateDocumentFormat(pngBuffer, 'IMAGE');
        
        expect(result).toBe(true);
      });

      it('should reject non-PNG files when IMAGE is expected', () => {
        // PDF signature
        const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
        
        const result = processor.validateDocumentFormat(pdfBuffer, 'IMAGE');
        
        expect(result).toBe(false);
      });
    });

    describe('JPG format validation', () => {
      it('should accept valid JPG files', () => {
        // JPG signature
        const jpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
        
        const result = processor.validateDocumentFormat(jpgBuffer, 'IMAGE');
        
        expect(result).toBe(true);
      });

      it('should accept JPG files with different markers', () => {
        // JPG with JFIF marker
        const jpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x16]);
        
        const result = processor.validateDocumentFormat(jpgBuffer, 'IMAGE');
        
        expect(result).toBe(true);
      });
    });

    describe('DOCX format validation', () => {
      it('should accept valid DOCX files', () => {
        // DOCX is a ZIP file with specific content
        // ZIP signature + DOCX markers
        const docxBuffer = Buffer.from([
          0x50, 0x4B, 0x03, 0x04, // ZIP signature
          ...Buffer.from('word/document.xml[Content_Types].xml'),
        ]);
        
        const result = processor.validateDocumentFormat(docxBuffer, 'DOCX');
        
        expect(result).toBe(true);
      });

      it('should reject regular ZIP files as DOCX', () => {
        // ZIP signature without DOCX markers
        const zipBuffer = Buffer.from([
          0x50, 0x4B, 0x03, 0x04, // ZIP signature
          ...Buffer.from('some/random/file.txt'),
        ]);
        
        const result = processor.validateDocumentFormat(zipBuffer, 'DOCX');
        
        expect(result).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should reject empty buffers', () => {
        const emptyBuffer = Buffer.from([]);
        
        const result = processor.validateDocumentFormat(emptyBuffer, 'PDF');
        
        expect(result).toBe(false);
      });

      it('should reject buffers that are too short', () => {
        // Only 2 bytes when PDF needs at least 4
        const shortBuffer = Buffer.from([0x25, 0x50]);
        
        const result = processor.validateDocumentFormat(shortBuffer, 'PDF');
        
        expect(result).toBe(false);
      });

      it('should reject buffers with incorrect signature', () => {
        // Random bytes that don't match any format
        const randomBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
        
        const result = processor.validateDocumentFormat(randomBuffer, 'PDF');
        
        expect(result).toBe(false);
      });
    });
  });

  describe('detectDocumentFormat', () => {
    it('should detect PDF format', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      
      const result = processor.detectDocumentFormat(pdfBuffer);
      
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('PDF');
      expect(result.errorMessage).toBeUndefined();
    });

    it('should detect PNG format', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      
      const result = processor.detectDocumentFormat(pngBuffer);
      
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('IMAGE');
      expect(result.errorMessage).toBeUndefined();
    });

    it('should detect JPG format', () => {
      const jpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      
      const result = processor.detectDocumentFormat(jpgBuffer);
      
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('IMAGE');
      expect(result.errorMessage).toBeUndefined();
    });

    it('should detect DOCX format', () => {
      const docxBuffer = Buffer.from([
        0x50, 0x4B, 0x03, 0x04,
        ...Buffer.from('word/document.xml[Content_Types].xml'),
      ]);
      
      const result = processor.detectDocumentFormat(docxBuffer);
      
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('DOCX');
      expect(result.errorMessage).toBeUndefined();
    });

    it('should return error for unsupported format', () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      
      const result = processor.detectDocumentFormat(unknownBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.detectedFormat).toBeUndefined();
      expect(result.errorMessage).toBe('Unsupported file format. Please upload PDF, DOCX, PNG, or JPG files.');
    });

    it('should return error for empty buffer', () => {
      const emptyBuffer = Buffer.from([]);
      
      const result = processor.detectDocumentFormat(emptyBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.detectedFormat).toBeUndefined();
      expect(result.errorMessage).toBe('File buffer is empty or invalid');
    });

    it('should distinguish DOCX from regular ZIP files', () => {
      const zipBuffer = Buffer.from([
        0x50, 0x4B, 0x03, 0x04,
        ...Buffer.from('some/file.txt'),
      ]);
      
      const result = processor.detectDocumentFormat(zipBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('ZIP archive but not a valid DOCX');
    });
  });

  describe('getFormatErrorMessage', () => {
    it('should return empty string for valid formats', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      
      const message = processor.getFormatErrorMessage(pdfBuffer);
      
      expect(message).toBe('');
    });

    it('should return clear error message for unsupported formats', () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      
      const message = processor.getFormatErrorMessage(unknownBuffer);
      
      expect(message).toBe('Unsupported file format. Please upload PDF, DOCX, PNG, or JPG files.');
    });

    it('should return clear error message for empty buffers', () => {
      const emptyBuffer = Buffer.from([]);
      
      const message = processor.getFormatErrorMessage(emptyBuffer);
      
      expect(message).toBe('File buffer is empty or invalid');
    });

    it('should return specific error for ZIP files that are not DOCX', () => {
      const zipBuffer = Buffer.from([
        0x50, 0x4B, 0x03, 0x04,
        ...Buffer.from('random/file.txt'),
      ]);
      
      const message = processor.getFormatErrorMessage(zipBuffer);
      
      expect(message).toContain('ZIP archive but not a valid DOCX');
    });
  });

  describe('extractQuestionsFromQuestionnaire', () => {
    it('should extract questions with various numbering patterns', async () => {
      // This is a placeholder test - actual implementation would require mocking Textract
      // For now, we'll test the helper methods that parse the extracted text
      
      const processor = new DocumentProcessor();
      
      // Test will be implemented with proper Textract mocking
      // For now, verify the method exists and has correct signature
      expect(processor.extractQuestionsFromQuestionnaire).toBeDefined();
      expect(typeof processor.extractQuestionsFromQuestionnaire).toBe('function');
    });

    it('should parse S3 URLs correctly', () => {
      const processor = new DocumentProcessor();
      
      // Access private method through type assertion for testing
      const parseS3Url = (processor as any).parseS3Url.bind(processor);
      
      const result = parseS3Url('s3://my-bucket/path/to/document.pdf');
      
      expect(result.bucket).toBe('my-bucket');
      expect(result.key).toBe('path/to/document.pdf');
    });

    it('should throw error for invalid S3 URLs', () => {
      const processor = new DocumentProcessor();
      const parseS3Url = (processor as any).parseS3Url.bind(processor);
      
      expect(() => parseS3Url('http://example.com/file.pdf')).toThrow('Invalid S3 URL format');
      expect(() => parseS3Url('s3://bucket-only')).toThrow('Invalid S3 URL format');
      expect(() => parseS3Url('s3://')).toThrow('Invalid S3 URL format');
    });

    it('should match various question numbering patterns', () => {
      const processor = new DocumentProcessor();
      const matchQuestion = (processor as any).matchQuestion.bind(processor);
      
      // Test pattern: "1. Question text"
      let result = matchQuestion('1. What is the capital of France?');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('1');
      expect(result?.text).toBe('What is the capital of France?');
      
      // Test pattern: "1) Question text"
      result = matchQuestion('2) Explain photosynthesis.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('2');
      
      // Test pattern: "1a. Question text"
      result = matchQuestion('3a. Define entropy.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('3a');
      
      // Test pattern: "1.1 Question text"
      result = matchQuestion('1.1 What is a variable?');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('1.1');
      
      // Test pattern: "Q1. Question text"
      result = matchQuestion('Q5. Describe the water cycle.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('5');
      
      // Test pattern: "Question 1: Question text"
      result = matchQuestion('Question 10: What is gravity?');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('10');
      
      // Test pattern: "(1) Question text"
      result = matchQuestion('(7) Explain the theory of relativity.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('7');
      
      // Test non-question text
      result = matchQuestion('This is just regular text without a question number.');
      expect(result).toBeNull();
    });

    it('should match section headers', () => {
      const processor = new DocumentProcessor();
      const matchSectionHeader = (processor as any).matchSectionHeader.bind(processor);
      
      // Test "Section 1:" pattern
      let result = matchSectionHeader('Section 1: Multiple Choice Questions');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Section 1: Multiple Choice Questions');
      
      // Test "Part A:" pattern
      result = matchSectionHeader('Part A: Short Answer Questions');
      expect(result).not.toBeNull();
      
      // Test "Section I -" pattern
      result = matchSectionHeader('Section I - Essay Questions');
      expect(result).not.toBeNull();
      
      // Test non-section text
      result = matchSectionHeader('This is just a regular line of text');
      expect(result).toBeNull();
    });

    it('should extract point values from question text', () => {
      const processor = new DocumentProcessor();
      const extractPoints = (processor as any).extractPoints.bind(processor);
      
      // Test "(5 points)" pattern
      expect(extractPoints('What is the answer? (5 points)')).toBe(5);
      
      // Test "[10 pts]" pattern
      expect(extractPoints('Explain the concept [10 pts]')).toBe(10);
      
      // Test "(3 marks)" pattern
      expect(extractPoints('Define the term (3 marks)')).toBe(3);
      
      // Test "15 points" pattern
      expect(extractPoints('Write an essay 15 points')).toBe(15);
      
      // Test default when no points specified
      expect(extractPoints('What is your name?')).toBe(1);
    });

    it('should parse questions and sections from text lines', () => {
      const processor = new DocumentProcessor();
      const parseQuestionsAndSections = (processor as any).parseQuestionsAndSections.bind(processor);
      
      const lines = [
        'Section 1: Multiple Choice',
        '1. What is 2+2? (5 points)',
        '2. What is the capital of France? (5 points)',
        'Section 2: Short Answer',
        '3. Explain photosynthesis. (10 points)',
        '4. Define gravity. (10 points)',
      ];
      
      const result = parseQuestionsAndSections(lines);
      
      expect(result.totalQuestions).toBe(4);
      expect(result.sections).toHaveLength(2);
      
      // Check first section
      expect(result.sections[0].sectionTitle).toBe('Section 1: Multiple Choice');
      expect(result.sections[0].questions).toHaveLength(2);
      expect(result.sections[0].questions[0].questionNumber).toBe('1');
      expect(result.sections[0].questions[0].points).toBe(5);
      
      // Check second section
      expect(result.sections[1].sectionTitle).toBe('Section 2: Short Answer');
      expect(result.sections[1].questions).toHaveLength(2);
      expect(result.sections[1].questions[0].questionNumber).toBe('3');
      expect(result.sections[1].questions[0].points).toBe(10);
    });

    it('should handle questions without explicit sections', () => {
      const processor = new DocumentProcessor();
      const parseQuestionsAndSections = (processor as any).parseQuestionsAndSections.bind(processor);
      
      const lines = [
        '1. What is your name?',
        '2. Where do you live?',
        '3. What is your favorite color?',
      ];
      
      const result = parseQuestionsAndSections(lines);
      
      expect(result.totalQuestions).toBe(3);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].sectionTitle).toBe('General');
      expect(result.sections[0].questions).toHaveLength(3);
    });

    it('should handle multi-line questions', () => {
      const processor = new DocumentProcessor();
      const parseQuestionsAndSections = (processor as any).parseQuestionsAndSections.bind(processor);
      
      const lines = [
        '1. What is the theory of relativity',
        'and how does it relate to space-time?',
        '2. Explain the concept of quantum mechanics.',
      ];
      
      const result = parseQuestionsAndSections(lines);
      
      expect(result.totalQuestions).toBe(2);
      expect(result.sections[0].questions[0].questionText).toContain('theory of relativity');
      expect(result.sections[0].questions[0].questionText).toContain('space-time');
    });
  });

  describe('extractAnswerKeyMappings', () => {
    it('should match various answer key entry patterns', () => {
      const processor = new DocumentProcessor();
      const matchAnswerKeyEntry = (processor as any).matchAnswerKeyEntry.bind(processor);
      
      // Test pattern: "1. Answer text"
      let result = matchAnswerKeyEntry('1. Paris is the capital of France.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('1');
      expect(result?.answer).toBe('Paris is the capital of France.');
      
      // Test pattern: "1) Answer text"
      result = matchAnswerKeyEntry('2) Photosynthesis is the process by which plants make food.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('2');
      
      // Test pattern: "1a. Answer text"
      result = matchAnswerKeyEntry('3a. Entropy is a measure of disorder.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('3a');
      
      // Test pattern: "Q1: Answer text"
      result = matchAnswerKeyEntry('Q5: The water cycle includes evaporation, condensation, and precipitation.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('5');
      
      // Test pattern: "Question 1: Answer text"
      result = matchAnswerKeyEntry('Question 10: Gravity is a force that attracts objects.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('10');
      
      // Test pattern: "Answer 1: Answer text"
      result = matchAnswerKeyEntry('Answer 7: E=mc² is Einstein\'s famous equation.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('7');
      
      // Test pattern: "(1) Answer text"
      result = matchAnswerKeyEntry('(8) The theory of relativity explains space-time.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('8');
      
      // Test pattern: "1: Answer text"
      result = matchAnswerKeyEntry('9: DNA stands for deoxyribonucleic acid.');
      expect(result).not.toBeNull();
      expect(result?.number).toBe('9');
      
      // Test non-answer text
      result = matchAnswerKeyEntry('This is just regular text without an answer number.');
      expect(result).toBeNull();
    });

    it('should extract keywords from answer text', () => {
      const processor = new DocumentProcessor();
      const extractKeywords = (processor as any).extractKeywords.bind(processor);
      
      // Test keyword extraction
      const keywords = extractKeywords('Paris is the capital of France and a major European city.');
      
      // Should include important words
      expect(keywords).toContain('paris');
      expect(keywords).toContain('capital');
      expect(keywords).toContain('france');
      expect(keywords).toContain('major');
      expect(keywords).toContain('european');
      expect(keywords).toContain('city');
      
      // Should not include stop words
      expect(keywords).not.toContain('is');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('of');
      expect(keywords).not.toContain('and');
      expect(keywords).not.toContain('a');
    });

    it('should parse answer key mappings from text lines', () => {
      const processor = new DocumentProcessor();
      const parseAnswerKeyMappings = (processor as any).parseAnswerKeyMappings.bind(processor);
      
      const lines = [
        '1. Paris is the capital of France.',
        '2. Photosynthesis is the process by which plants convert light into energy.',
        '3. The water cycle includes evaporation, condensation, and precipitation.',
      ];
      
      const result = parseAnswerKeyMappings(lines);
      
      expect(result).toHaveLength(3);
      
      // Check first answer
      expect(result[0].questionNumber).toBe('1');
      expect(result[0].expectedAnswer).toBe('Paris is the capital of France.');
      expect(result[0].keywords).toContain('paris');
      expect(result[0].keywords).toContain('capital');
      expect(result[0].keywords).toContain('france');
      
      // Check second answer
      expect(result[1].questionNumber).toBe('2');
      expect(result[1].expectedAnswer).toContain('Photosynthesis');
      expect(result[1].keywords).toContain('photosynthesis');
      expect(result[1].keywords).toContain('plants');
      
      // Check third answer
      expect(result[2].questionNumber).toBe('3');
      expect(result[2].expectedAnswer).toContain('water cycle');
      expect(result[2].keywords).toContain('water');
      expect(result[2].keywords).toContain('cycle');
    });

    it('should handle multi-line answers', () => {
      const processor = new DocumentProcessor();
      const parseAnswerKeyMappings = (processor as any).parseAnswerKeyMappings.bind(processor);
      
      const lines = [
        '1. The theory of relativity, developed by Albert Einstein,',
        'explains the relationship between space and time.',
        '2. Quantum mechanics is a fundamental theory in physics.',
      ];
      
      const result = parseAnswerKeyMappings(lines);
      
      expect(result).toHaveLength(2);
      expect(result[0].expectedAnswer).toContain('theory of relativity');
      expect(result[0].expectedAnswer).toContain('Albert Einstein');
      expect(result[0].expectedAnswer).toContain('space and time');
    });

    it('should handle various answer formats', () => {
      const processor = new DocumentProcessor();
      const parseAnswerKeyMappings = (processor as any).parseAnswerKeyMappings.bind(processor);
      
      const lines = [
        'Q1: Paris',
        'Answer 2: London',
        '3) Berlin',
        'Question 4. Madrid',
        '(5) Rome',
      ];
      
      const result = parseAnswerKeyMappings(lines);
      
      expect(result).toHaveLength(5);
      expect(result[0].questionNumber).toBe('1');
      expect(result[0].expectedAnswer).toBe('Paris');
      expect(result[1].questionNumber).toBe('2');
      expect(result[1].expectedAnswer).toBe('London');
      expect(result[2].questionNumber).toBe('3');
      expect(result[2].expectedAnswer).toBe('Berlin');
      expect(result[3].questionNumber).toBe('4');
      expect(result[3].expectedAnswer).toBe('Madrid');
      expect(result[4].questionNumber).toBe('5');
      expect(result[4].expectedAnswer).toBe('Rome');
    });
  });
});
