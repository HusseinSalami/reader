// Unit Tests for Validation Engine
// Tests specific examples and edge cases for each validator

import {
  validateRequired,
  validateFormat,
  validateRange,
  validateRegex,
  validateDateFormat,
  validateField,
  validateFieldWithRules,
  validateDocument,
} from './validation';
import { ValidationRule } from './data-models';

describe('Validation Engine', () => {
  
  // ========================================
  // Required Field Validator Tests
  // ========================================
  
  describe('validateRequired', () => {
    it('should pass for non-empty string', () => {
      const result = validateRequired('hello');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should pass for number zero', () => {
      const result = validateRequired(0);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should pass for boolean false', () => {
      const result = validateRequired(false);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should pass for non-empty array', () => {
      const result = validateRequired([1, 2, 3]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail for null', () => {
      const result = validateRequired(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].rule).toBe('required');
      expect(result.errors[0].message).toContain('required');
    });
    
    it('should fail for undefined', () => {
      const result = validateRequired(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
    
    it('should fail for empty string', () => {
      const result = validateRequired('');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
    
    it('should fail for whitespace-only string', () => {
      const result = validateRequired('   ');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
    
    it('should fail for empty array', () => {
      const result = validateRequired([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
  
  // ========================================
  // Format Validator Tests
  // ========================================
  
  describe('validateFormat', () => {
    it('should validate email format correctly', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'first+last@company.org',
      ];
      
      for (const email of validEmails) {
        const result = validateFormat(email, { format: 'email' });
        expect(result.valid).toBe(true);
      }
    });
    
    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
      ];
      
      for (const email of invalidEmails) {
        const result = validateFormat(email, { format: 'email' });
        expect(result.valid).toBe(false);
        expect(result.errors[0].message).toContain('email');
      }
    });
    
    it('should validate phone format correctly', () => {
      const validPhones = [
        '1234567890',
        '+12345678900',
        '123-456-7890',
      ];
      
      for (const phone of validPhones) {
        const result = validateFormat(phone, { format: 'phone' });
        expect(result.valid).toBe(true);
      }
    });
    
    it('should validate URL format correctly', () => {
      const validUrls = [
        'http://example.com',
        'https://www.example.com',
        'https://example.com/path/to/page',
        'https://example.com:8080/path?query=value',
      ];
      
      for (const url of validUrls) {
        const result = validateFormat(url, { format: 'url' });
        expect(result.valid).toBe(true);
      }
    });
    
    it('should validate UUID format correctly', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = validateFormat(validUuid, { format: 'uuid' });
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid UUID', () => {
      const invalidUuid = 'not-a-uuid';
      const result = validateFormat(invalidUuid, { format: 'uuid' });
      expect(result.valid).toBe(false);
    });
    
    it('should support custom format patterns', () => {
      const result = validateFormat('ABC-123', { format: '^[A-Z]{3}-\\d{3}$' });
      expect(result.valid).toBe(true);
    });
    
    it('should fail with missing format parameter', () => {
      const result = validateFormat('test', {} as any);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Format parameter is required');
    });
  });
  
  // ========================================
  // Range Validator Tests
  // ========================================
  
  describe('validateRange', () => {
    it('should pass for value within range', () => {
      const result = validateRange(50, { min: 0, max: 100 });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should pass for value at minimum boundary', () => {
      const result = validateRange(0, { min: 0, max: 100 });
      expect(result.valid).toBe(true);
    });
    
    it('should pass for value at maximum boundary', () => {
      const result = validateRange(100, { min: 0, max: 100 });
      expect(result.valid).toBe(true);
    });
    
    it('should fail for value below minimum', () => {
      const result = validateRange(-1, { min: 0, max: 100 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('less than minimum');
    });
    
    it('should fail for value above maximum', () => {
      const result = validateRange(101, { min: 0, max: 100 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('greater than maximum');
    });
    
    it('should support only minimum constraint', () => {
      const result = validateRange(50, { min: 0 });
      expect(result.valid).toBe(true);
    });
    
    it('should support only maximum constraint', () => {
      const result = validateRange(50, { max: 100 });
      expect(result.valid).toBe(true);
    });
    
    it('should handle string numbers', () => {
      const result = validateRange('50', { min: 0, max: 100 });
      expect(result.valid).toBe(true);
    });
    
    it('should fail for non-numeric values', () => {
      const result = validateRange('not a number', { min: 0, max: 100 });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('valid number');
    });
    
    it('should handle negative ranges', () => {
      const result = validateRange(-50, { min: -100, max: 0 });
      expect(result.valid).toBe(true);
    });
    
    it('should handle decimal values', () => {
      const result = validateRange(3.14, { min: 0, max: 10 });
      expect(result.valid).toBe(true);
    });
  });
  
  // ========================================
  // Regex Validator Tests
  // ========================================
  
  describe('validateRegex', () => {
    it('should validate invoice number pattern', () => {
      const result = validateRegex('INV-123456', { pattern: '^INV-\\d{6}$' });
      expect(result.valid).toBe(true);
    });
    
    it('should reject non-matching pattern', () => {
      const result = validateRegex('INV-ABC', { pattern: '^INV-\\d{6}$' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('does not match pattern');
    });
    
    it('should support regex flags', () => {
      const result = validateRegex('hello', { pattern: '^HELLO$', flags: 'i' });
      expect(result.valid).toBe(true);
    });
    
    it('should validate postal codes', () => {
      const result = validateRegex('12345', { pattern: '^\\d{5}$' });
      expect(result.valid).toBe(true);
    });
    
    it('should fail with missing pattern parameter', () => {
      const result = validateRegex('test', {} as any);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Pattern parameter is required');
    });
    
    it('should handle invalid regex patterns', () => {
      const result = validateRegex('test', { pattern: '[invalid(' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid regex pattern');
    });
  });
  
  // ========================================
  // Date Format Validator Tests
  // ========================================
  
  describe('validateDateFormat', () => {
    it('should validate ISO8601 format', () => {
      const validDates = [
        '2024-01-15',
        '2024-01-15T10:30:00',
        '2024-01-15T10:30:00.000Z',
      ];
      
      for (const date of validDates) {
        const result = validateDateFormat(date, { format: 'ISO8601' });
        expect(result.valid).toBe(true);
      }
    });
    
    it('should validate US date format', () => {
      const result = validateDateFormat('01/15/2024', { format: 'US' });
      expect(result.valid).toBe(true);
    });
    
    it('should validate European date format', () => {
      const result = validateDateFormat('15/01/2024', { format: 'EU' });
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid ISO8601 format', () => {
      const result = validateDateFormat('2024/01/15', { format: 'ISO8601' });
      expect(result.valid).toBe(false);
    });
    
    it('should reject invalid US format', () => {
      const result = validateDateFormat('15/01/2024', { format: 'US' });
      expect(result.valid).toBe(false);
    });
    
    it('should reject invalid dates', () => {
      const result = validateDateFormat('02/31/2024', { format: 'US' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('not a valid date');
    });
    
    it('should support custom date formats', () => {
      const result = validateDateFormat('2024-01-15', { format: 'YYYY-MM-DD' });
      expect(result.valid).toBe(true);
    });
    
    it('should fail with missing format parameter', () => {
      const result = validateDateFormat('2024-01-15', {} as any);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Format parameter is required');
    });
  });
  
  // ========================================
  // Validation Engine Tests
  // ========================================
  
  describe('validateField', () => {
    it('should validate required rule', () => {
      const rule: ValidationRule = { type: 'required', params: {} };
      const result = validateField('value', rule);
      expect(result.valid).toBe(true);
    });
    
    it('should validate format rule', () => {
      const rule: ValidationRule = { type: 'format', params: { format: 'email' } };
      const result = validateField('test@example.com', rule);
      expect(result.valid).toBe(true);
    });
    
    it('should validate range rule', () => {
      const rule: ValidationRule = { type: 'range', params: { min: 0, max: 100 } };
      const result = validateField(50, rule);
      expect(result.valid).toBe(true);
    });
    
    it('should validate regex rule', () => {
      const rule: ValidationRule = { type: 'regex', params: { pattern: '^\\d{3}$' } };
      const result = validateField('123', rule);
      expect(result.valid).toBe(true);
    });
    
    it('should validate dateFormat rule', () => {
      const rule: ValidationRule = { type: 'dateFormat', params: { format: 'ISO8601' } };
      const result = validateField('2024-01-15', rule);
      expect(result.valid).toBe(true);
    });
    
    it('should handle unknown rule types', () => {
      const rule: ValidationRule = { type: 'unknown' as any, params: {} };
      const result = validateField('value', rule);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Unknown validation rule type');
    });
  });
  
  describe('validateFieldWithRules', () => {
    it('should pass when all rules pass', () => {
      const rules: ValidationRule[] = [
        { type: 'required', params: {} },
        { type: 'format', params: { format: 'email' } },
      ];
      const result = validateFieldWithRules('test@example.com', rules);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail when any rule fails', () => {
      const rules: ValidationRule[] = [
        { type: 'required', params: {} },
        { type: 'format', params: { format: 'email' } },
      ];
      const result = validateFieldWithRules('not-an-email', rules);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should collect all errors from multiple failing rules', () => {
      const rules: ValidationRule[] = [
        { type: 'required', params: {} },
        { type: 'range', params: { min: 10, max: 20 } },
      ];
      const result = validateFieldWithRules('', rules);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
    
    it('should handle empty rules array', () => {
      const result = validateFieldWithRules('value', []);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
  
  describe('validateDocument', () => {
    it('should validate all fields in a document', () => {
      const extractedData = {
        'field-1': 'test@example.com',
        'field-2': 50,
      };
      
      const fields = [
        {
          fieldId: 'field-1',
          name: 'email',
          validationRules: [
            { type: 'required' as const, params: {} },
            { type: 'format' as const, params: { format: 'email' } },
          ],
        },
        {
          fieldId: 'field-2',
          name: 'age',
          validationRules: [
            { type: 'required' as const, params: {} },
            { type: 'range' as const, params: { min: 0, max: 120 } },
          ],
        },
      ];
      
      const results = validateDocument(extractedData, fields);
      
      expect(results['field-1'].valid).toBe(true);
      expect(results['field-2'].valid).toBe(true);
    });
    
    it('should return errors for invalid fields', () => {
      const extractedData = {
        'field-1': 'not-an-email',
        'field-2': 150,
      };
      
      const fields = [
        {
          fieldId: 'field-1',
          name: 'email',
          validationRules: [
            { type: 'format' as const, params: { format: 'email' } },
          ],
        },
        {
          fieldId: 'field-2',
          name: 'age',
          validationRules: [
            { type: 'range' as const, params: { min: 0, max: 120 } },
          ],
        },
      ];
      
      const results = validateDocument(extractedData, fields);
      
      expect(results['field-1'].valid).toBe(false);
      expect(results['field-2'].valid).toBe(false);
    });
    
    it('should handle missing fields', () => {
      const extractedData = {};
      
      const fields = [
        {
          fieldId: 'field-1',
          name: 'email',
          validationRules: [
            { type: 'required' as const, params: {} },
          ],
        },
      ];
      
      const results = validateDocument(extractedData, fields);
      
      expect(results['field-1'].valid).toBe(false);
      expect(results['field-1'].errors[0].rule).toBe('required');
    });
  });
  
  // ========================================
  // Edge Cases
  // ========================================
  
  describe('Edge Cases', () => {
    it('should handle very large numbers in range validation', () => {
      const result = validateRange(Number.MAX_SAFE_INTEGER, { 
        min: 0, 
        max: Number.MAX_SAFE_INTEGER 
      });
      expect(result.valid).toBe(true);
    });
    
    it('should handle very small numbers in range validation', () => {
      const result = validateRange(Number.MIN_SAFE_INTEGER, { 
        min: Number.MIN_SAFE_INTEGER, 
        max: 0 
      });
      expect(result.valid).toBe(true);
    });
    
    it('should handle special characters in regex patterns', () => {
      const result = validateRegex('$100.00', { pattern: '^\\$\\d+\\.\\d{2}$' });
      expect(result.valid).toBe(true);
    });
    
    it('should handle unicode characters', () => {
      const result = validateRequired('こんにちは');
      expect(result.valid).toBe(true);
    });
    
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const result = validateRequired(longString);
      expect(result.valid).toBe(true);
    });
  });
});
