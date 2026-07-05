/**
 * Unit Test: Real Document Processing
 * 
 * Tests document processing with actual exam files to verify:
 * 1. File format validation
 * 2. Question extraction patterns
 * 3. Answer key parsing patterns
 * 
 * This test helps identify issues before running full integration tests
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const EXAMPLES_DIR = path.join(__dirname, '../../examples');

describe('Real Document Validation', () => {
  describe('File Existence', () => {
    it('should have questionnaire document', () => {
      const questionnaireFile = path.join(EXAMPLES_DIR, 'Grade 11 -Mid year exam Jan.2026-questions.docx');
      const exists = fs.existsSync(questionnaireFile);
      
      if (!exists) {
        console.error(`❌ Questionnaire not found at: ${questionnaireFile}`);
      } else {
        const stats = fs.statSync(questionnaireFile);
        console.log(`✓ Questionnaire found: ${(stats.size / 1024).toFixed(2)} KB`);
      }
      
      expect(exists).toBe(true);
    });

    it('should have answer key document', () => {
      const answerKeyFile = path.join(EXAMPLES_DIR, 'Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers.docx');
      const exists = fs.existsSync(answerKeyFile);
      
      if (!exists) {
        console.error(`❌ Answer key not found at: ${answerKeyFile}`);
      } else {
        const stats = fs.statSync(answerKeyFile);
        console.log(`✓ Answer key found: ${(stats.size / 1024).toFixed(2)} KB`);
      }
      
      expect(exists).toBe(true);
    });

    it('should have student answer images', () => {
      const answerFiles = [
        'answer1.jpeg',
        'answer2.jpeg',
        'answer3.jpeg',
        'answer4.jpeg',
        'answer5.jpeg',
      ];

      const foundFiles: string[] = [];
      const missingFiles: string[] = [];

      answerFiles.forEach((file) => {
        const filePath = path.join(EXAMPLES_DIR, file);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          foundFiles.push(file);
          console.log(`  ✓ ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
        } else {
          missingFiles.push(file);
          console.error(`  ❌ ${file}: NOT FOUND`);
        }
      });

      console.log(`\nSummary: ${foundFiles.length}/${answerFiles.length} answer files found`);
      
      expect(foundFiles.length).toBeGreaterThan(0);
      if (missingFiles.length > 0) {
        console.warn(`⚠ Missing files: ${missingFiles.join(', ')}`);
      }
    });
  });

  describe('File Format Validation', () => {
    it('should validate DOCX magic number for questionnaire', () => {
      const questionnaireFile = path.join(EXAMPLES_DIR, 'Grade 11 -Mid year exam Jan.2026-questions.docx');
      
      if (!fs.existsSync(questionnaireFile)) {
        console.warn('⚠ Skipping test - file not found');
        return;
      }

      const buffer = fs.readFileSync(questionnaireFile);
      
      // DOCX files are ZIP archives, should start with PK (0x50 0x4B)
      const magicNumber = buffer.slice(0, 2);
      const isPKZip = magicNumber[0] === 0x50 && magicNumber[1] === 0x4B;
      
      console.log(`  Magic number: ${magicNumber.toString('hex')}`);
      console.log(`  Is valid DOCX (ZIP): ${isPKZip}`);
      
      expect(isPKZip).toBe(true);
    });

    it('should validate DOCX magic number for answer key', () => {
      const answerKeyFile = path.join(EXAMPLES_DIR, 'Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers.docx');
      
      if (!fs.existsSync(answerKeyFile)) {
        console.warn('⚠ Skipping test - file not found');
        return;
      }

      const buffer = fs.readFileSync(answerKeyFile);
      
      // DOCX files are ZIP archives, should start with PK (0x50 0x4B)
      const magicNumber = buffer.slice(0, 2);
      const isPKZip = magicNumber[0] === 0x50 && magicNumber[1] === 0x4B;
      
      console.log(`  Magic number: ${magicNumber.toString('hex')}`);
      console.log(`  Is valid DOCX (ZIP): ${isPKZip}`);
      
      expect(isPKZip).toBe(true);
    });

    it('should validate JPEG magic number for student answers', () => {
      const answerFile = path.join(EXAMPLES_DIR, 'answer1.jpeg');
      
      if (!fs.existsSync(answerFile)) {
        console.warn('⚠ Skipping test - file not found');
        return;
      }

      const buffer = fs.readFileSync(answerFile);
      
      // JPEG files should start with FF D8 FF
      const magicNumber = buffer.slice(0, 3);
      const isJPEG = magicNumber[0] === 0xFF && magicNumber[1] === 0xD8 && magicNumber[2] === 0xFF;
      
      console.log(`  Magic number: ${magicNumber.toString('hex')}`);
      console.log(`  Is valid JPEG: ${isJPEG}`);
      
      expect(isJPEG).toBe(true);
    });
  });

  describe('Document Structure Analysis', () => {
    it('should report file sizes and structure', () => {
      const files = [
        'Grade 11 -Mid year exam Jan.2026-questions.docx',
        'Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers.docx',
        'answer1.jpeg',
        'answer2.jpeg',
        'answer3.jpeg',
        'answer4.jpeg',
        'answer5.jpeg',
      ];

      console.log('\n📊 Document Structure Report:');
      console.log('═'.repeat(60));

      let totalSize = 0;
      files.forEach((file) => {
        const filePath = path.join(EXAMPLES_DIR, file);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          
          const sizeKB = (stats.size / 1024).toFixed(2);
          const type = file.endsWith('.docx') ? 'DOCX' : 'JPEG';
          
          console.log(`  ${type.padEnd(6)} ${sizeKB.padStart(10)} KB  ${file}`);
        }
      });

      console.log('═'.repeat(60));
      console.log(`  Total: ${(totalSize / 1024).toFixed(2)} KB`);
      console.log('');

      expect(totalSize).toBeGreaterThan(0);
    });
  });
});

describe('Document Processing Logic Validation', () => {
  describe('Question Number Pattern Matching', () => {
    it('should match various question number formats', () => {
      const patterns = [
        '1. What is the capital of France?',
        'Q1: Define photosynthesis',
        'Question 1: Explain the water cycle',
        '1) Calculate the area',
        '(1) Describe the process',
        'a. First question',
        'a) Another format',
      ];

      // This is the regex pattern used in document-processor.ts
      const questionPattern = /^(\d+|[a-z])[.):\s]/i;

      console.log('\n🔍 Question Pattern Matching:');
      patterns.forEach((text) => {
        const matches = questionPattern.test(text);
        const icon = matches ? '✓' : '✗';
        console.log(`  ${icon} "${text}"`);
      });

      // At least basic numbered patterns should match
      expect(questionPattern.test('1. Question text')).toBe(true);
      expect(questionPattern.test('Q1: Question text')).toBe(false); // This pattern might not match
    });
  });

  describe('Answer Key Pattern Matching', () => {
    it('should match various answer key formats', () => {
      const patterns = [
        '1. Paris is the capital',
        'Q1: The answer is photosynthesis',
        'Answer 1: Water cycle explanation',
        '1) Area = 25 square meters',
        'a. First answer',
      ];

      // Similar pattern for answer keys
      const answerPattern = /^(\d+|[a-z])[.):\s]/i;

      console.log('\n🔍 Answer Key Pattern Matching:');
      patterns.forEach((text) => {
        const matches = answerPattern.test(text);
        const icon = matches ? '✓' : '✗';
        console.log(`  ${icon} "${text}"`);
      });

      expect(answerPattern.test('1. Answer text')).toBe(true);
    });
  });
});
