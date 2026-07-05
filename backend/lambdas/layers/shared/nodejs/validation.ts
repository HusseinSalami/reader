// Validation Engine for Document Type & Template Management
// Implements validation rules for extracted field values

import { ValidationRule, ValidationType, FieldDataType } from './data-models';

// ========================================
// Validation Result Types
// ========================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
  rule: ValidationType;
  message: string;
  value: any;
}

// ========================================
// Individual Validator Functions
// ========================================

/**
 * Validates that a field has a non-empty value
 * Requirements: 3.1
 */
export function validateRequired(value: any): ValidationResult {
  const errors: ValidationErrorDetail[] = [];
  
  // Check for null, undefined, empty string, or empty array
  const isEmpty = 
    value === null || 
    value === undefined || 
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0);
  
  if (isEmpty) {
    errors.push({
      rule: 'required',
      message: 'Field is required and cannot be empty',
      value,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that a value matches a specific format pattern
 * Requirements: 3.2
 * 
 * Supported formats:
 * - email: Email address format
 * - phone: Phone number format (various international formats)
 * - url: URL format
 * - uuid: UUID format
 * - custom: Custom format string (treated as regex)
 */
export function validateFormat(value: any, params: { format: string }): ValidationResult {
  const errors: ValidationErrorDetail[] = [];
  
  if (!params.format) {
    errors.push({
      rule: 'format',
      message: 'Format parameter is required',
      value,
    });
    return { valid: false, errors };
  }
  
  // Convert value to string for format validation
  const strValue = String(value);
  
  let pattern: RegExp;
  let formatName: string;
  
  switch (params.format.toLowerCase()) {
    case 'email':
      pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      formatName = 'email address';
      break;
    case 'phone':
      // Supports various international phone formats
      pattern = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
      formatName = 'phone number';
      break;
    case 'url':
      pattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
      formatName = 'URL';
      break;
    case 'uuid':
      pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      formatName = 'UUID';
      break;
    default:
      // Treat as custom regex pattern
      try {
        pattern = new RegExp(params.format);
        formatName = 'specified format';
      } catch (e) {
        errors.push({
          rule: 'format',
          message: `Invalid format pattern: ${params.format}`,
          value,
        });
        return { valid: false, errors };
      }
  }
  
  if (!pattern.test(strValue)) {
    errors.push({
      rule: 'format',
      message: `Value does not match ${formatName} format`,
      value,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that a numeric value falls within a specified range
 * Requirements: 3.3
 */
export function validateRange(value: any, params: { min?: number; max?: number }): ValidationResult {
  const errors: ValidationErrorDetail[] = [];
  
  // Convert value to number
  const numValue = typeof value === 'number' ? value : Number(value);
  
  if (isNaN(numValue)) {
    errors.push({
      rule: 'range',
      message: 'Value must be a valid number for range validation',
      value,
    });
    return { valid: false, errors };
  }
  
  // Check minimum bound
  if (params.min !== undefined && numValue < params.min) {
    errors.push({
      rule: 'range',
      message: `Value ${numValue} is less than minimum ${params.min}`,
      value,
    });
  }
  
  // Check maximum bound
  if (params.max !== undefined && numValue > params.max) {
    errors.push({
      rule: 'range',
      message: `Value ${numValue} is greater than maximum ${params.max}`,
      value,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that a value matches a regular expression pattern
 * Requirements: 3.4
 */
export function validateRegex(value: any, params: { pattern: string; flags?: string }): ValidationResult {
  const errors: ValidationErrorDetail[] = [];
  
  if (!params.pattern) {
    errors.push({
      rule: 'regex',
      message: 'Pattern parameter is required',
      value,
    });
    return { valid: false, errors };
  }
  
  // Convert value to string for regex validation
  const strValue = String(value);
  
  try {
    const regex = new RegExp(params.pattern, params.flags);
    
    if (!regex.test(strValue)) {
      errors.push({
        rule: 'regex',
        message: `Value does not match pattern: ${params.pattern}`,
        value,
      });
    }
  } catch (e) {
    errors.push({
      rule: 'regex',
      message: `Invalid regex pattern: ${params.pattern}`,
      value,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that a date value matches a specified format
 * Requirements: 3.5
 * 
 * Supported formats:
 * - ISO8601: ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
 * - US: US format (MM/DD/YYYY)
 * - EU: European format (DD/MM/YYYY)
 * - custom: Custom format string using tokens (YYYY, MM, DD, etc.)
 */
export function validateDateFormat(value: any, params: { format: string }): ValidationResult {
  const errors: ValidationErrorDetail[] = [];
  
  if (!params.format) {
    errors.push({
      rule: 'dateFormat',
      message: 'Format parameter is required',
      value,
    });
    return { valid: false, errors };
  }
  
  const strValue = String(value);
  let pattern: RegExp;
  let formatName: string;
  
  switch (params.format.toUpperCase()) {
    case 'ISO8601':
    case 'ISO':
      // Matches YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sssZ
      pattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
      formatName = 'ISO 8601';
      break;
    case 'US':
      // Matches MM/DD/YYYY
      pattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
      formatName = 'US (MM/DD/YYYY)';
      break;
    case 'EU':
      // Matches DD/MM/YYYY
      pattern = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
      formatName = 'European (DD/MM/YYYY)';
      break;
    default:
      // Custom format - convert format string to regex
      // First escape special regex characters EXCEPT the format tokens
      let regexPattern = params.format;
      
      // Replace format tokens with placeholders
      regexPattern = regexPattern
        .replace(/YYYY/g, '__YEAR__')
        .replace(/MM/g, '__MONTH__')
        .replace(/DD/g, '__DAY__')
        .replace(/HH/g, '__HOUR__')
        .replace(/mm/g, '__MINUTE__')
        .replace(/ss/g, '__SECOND__');
      
      // Escape special regex characters
      regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Replace placeholders with regex patterns
      regexPattern = regexPattern
        .replace(/__YEAR__/g, '\\d{4}')
        .replace(/__MONTH__/g, '\\d{2}')
        .replace(/__DAY__/g, '\\d{2}')
        .replace(/__HOUR__/g, '\\d{2}')
        .replace(/__MINUTE__/g, '\\d{2}')
        .replace(/__SECOND__/g, '\\d{2}');
      
      try {
        pattern = new RegExp(`^${regexPattern}$`);
        formatName = params.format;
      } catch (e) {
        errors.push({
          rule: 'dateFormat',
          message: `Invalid date format pattern: ${params.format}`,
          value,
        });
        return { valid: false, errors };
      }
  }
  
  if (!pattern.test(strValue)) {
    errors.push({
      rule: 'dateFormat',
      message: `Value does not match ${formatName} date format`,
      value,
    });
  }
  
  // Additional validation: check if the date is actually valid
  // (e.g., not 02/31/2024)
  if (errors.length === 0) {
    // Try to parse the date - for US and EU formats, we need to convert to ISO format first
    let dateToValidate = strValue;
    
    if (params.format.toUpperCase() === 'US') {
      // Convert MM/DD/YYYY to YYYY-MM-DD
      const parts = strValue.split('/');
      dateToValidate = `${parts[2]}-${parts[0]}-${parts[1]}`;
    } else if (params.format.toUpperCase() === 'EU') {
      // Convert DD/MM/YYYY to YYYY-MM-DD
      const parts = strValue.split('/');
      dateToValidate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    
    const date = new Date(dateToValidate);
    if (isNaN(date.getTime())) {
      errors.push({
        rule: 'dateFormat',
        message: `Value is not a valid date`,
        value,
      });
    } else {
      // Additional check: verify the date components match what was input
      // This catches cases like 02/31/2024 which JavaScript converts to 03/03/2024
      if (params.format.toUpperCase() === 'US') {
        const parts = strValue.split('/');
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        if (date.getUTCFullYear() !== year || 
            date.getUTCMonth() + 1 !== month || 
            date.getUTCDate() !== day) {
          errors.push({
            rule: 'dateFormat',
            message: `Value is not a valid date`,
            value,
          });
        }
      } else if (params.format.toUpperCase() === 'EU') {
        const parts = strValue.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        if (date.getUTCFullYear() !== year || 
            date.getUTCMonth() + 1 !== month || 
            date.getUTCDate() !== day) {
          errors.push({
            rule: 'dateFormat',
            message: `Value is not a valid date`,
            value,
          });
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ========================================
// Validation Engine
// ========================================

/**
 * Validates a single field value against a validation rule
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export function validateField(value: any, rule: ValidationRule): ValidationResult {
  switch (rule.type) {
    case 'required':
      return validateRequired(value);
    
    case 'format':
      return validateFormat(value, rule.params as { format: string });
    
    case 'range':
      return validateRange(value, rule.params as { min?: number; max?: number });
    
    case 'regex':
      return validateRegex(value, rule.params as { pattern: string; flags?: string });
    
    case 'dateFormat':
      return validateDateFormat(value, rule.params as { format: string });
    
    default:
      return {
        valid: false,
        errors: [{
          rule: rule.type,
          message: `Unknown validation rule type: ${rule.type}`,
          value,
        }],
      };
  }
}

/**
 * Validates a field value against multiple validation rules
 * Requirements: 3.7
 * 
 * All rules are applied, and all errors are collected
 */
export function validateFieldWithRules(value: any, rules: ValidationRule[]): ValidationResult {
  const allErrors: ValidationErrorDetail[] = [];
  
  for (const rule of rules) {
    const result = validateField(value, rule);
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Validates all fields in an extracted document
 * Requirements: 3.6, 3.7
 * 
 * Returns a map of field IDs to validation results
 */
export function validateDocument(
  extractedData: Record<string, any>,
  fields: Array<{ fieldId: string; name: string; validationRules: ValidationRule[] }>
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {};
  
  for (const field of fields) {
    const value = extractedData[field.fieldId];
    const result = validateFieldWithRules(value, field.validationRules);
    results[field.fieldId] = result;
  }
  
  return results;
}
