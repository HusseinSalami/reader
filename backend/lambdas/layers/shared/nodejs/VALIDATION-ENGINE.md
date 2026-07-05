# Validation Engine

## Overview

The validation engine provides comprehensive field validation for extracted document data. It implements five validation rule types as specified in the design document.

## Validation Rule Types

### 1. Required Field Validator
**Requirements: 3.1**

Validates that a field has a non-empty value.

- Checks for `null`, `undefined`, empty strings, and empty arrays
- Whitespace-only strings are considered empty
- Zero and `false` are considered valid values

**Example:**
```typescript
const rule: ValidationRule = { type: 'required', params: {} };
validateField('value', rule); // valid: true
validateField('', rule);      // valid: false
validateField(null, rule);    // valid: false
```

### 2. Format Validator
**Requirements: 3.2**

Validates that a value matches a specific format pattern.

**Supported formats:**
- `email`: Email address format
- `phone`: Phone number format (various international formats)
- `url`: URL format (http/https)
- `uuid`: UUID format
- Custom: Any regex pattern

**Example:**
```typescript
const rule: ValidationRule = { 
  type: 'format', 
  params: { format: 'email' } 
};
validateField('test@example.com', rule); // valid: true
validateField('not-an-email', rule);     // valid: false
```

### 3. Range Validator
**Requirements: 3.3**

Validates that a numeric value falls within a specified range.

- Supports `min` and/or `max` bounds
- Converts string numbers to numeric values
- Boundary values are inclusive

**Example:**
```typescript
const rule: ValidationRule = { 
  type: 'range', 
  params: { min: 0, max: 100 } 
};
validateField(50, rule);   // valid: true
validateField(150, rule);  // valid: false
```

### 4. Regex Validator
**Requirements: 3.4**

Validates that a value matches a regular expression pattern.

- Supports custom regex patterns
- Supports regex flags (i, g, m, etc.)
- Useful for custom formats like invoice numbers, postal codes, etc.

**Example:**
```typescript
const rule: ValidationRule = { 
  type: 'regex', 
  params: { pattern: '^INV-\\d{6}$' } 
};
validateField('INV-123456', rule); // valid: true
validateField('INV-ABC', rule);    // valid: false
```

### 5. Date Format Validator
**Requirements: 3.5**

Validates that a date value matches a specified format.

**Supported formats:**
- `ISO8601` or `ISO`: ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
- `US`: US format (MM/DD/YYYY)
- `EU`: European format (DD/MM/YYYY)
- Custom: Custom format using tokens (YYYY, MM, DD, HH, mm, ss)

**Additional validation:**
- Checks if the date is actually valid (e.g., rejects 02/31/2024)
- For US and EU formats, verifies date components match input

**Example:**
```typescript
const rule: ValidationRule = { 
  type: 'dateFormat', 
  params: { format: 'ISO8601' } 
};
validateField('2024-01-15', rule);     // valid: true
validateField('2024/01/15', rule);     // valid: false
validateField('02/31/2024', rule);     // valid: false (invalid date)
```

## Validation Engine Functions

### `validateField(value: any, rule: ValidationRule): ValidationResult`

Validates a single field value against a validation rule.

**Returns:**
```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorDetail[];
}

interface ValidationErrorDetail {
  rule: ValidationType;
  message: string;
  value: any;
}
```

### `validateFieldWithRules(value: any, rules: ValidationRule[]): ValidationResult`

Validates a field value against multiple validation rules.

**Requirements: 3.7**

- All rules are applied
- All errors are collected
- Returns combined validation result

**Example:**
```typescript
const rules: ValidationRule[] = [
  { type: 'required', params: {} },
  { type: 'format', params: { format: 'email' } },
];
validateFieldWithRules('test@example.com', rules); // valid: true
```

### `validateDocument(extractedData, fields): Record<string, ValidationResult>`

Validates all fields in an extracted document.

**Requirements: 3.6, 3.7**

- Validates each field against its validation rules
- Returns a map of field IDs to validation results
- Used by the processing pipeline to validate extracted data

**Example:**
```typescript
const extractedData = {
  'field-1': 'test@example.com',
  'field-2': 50,
};

const fields = [
  {
    fieldId: 'field-1',
    name: 'email',
    validationRules: [
      { type: 'required', params: {} },
      { type: 'format', params: { format: 'email' } },
    ],
  },
  {
    fieldId: 'field-2',
    name: 'age',
    validationRules: [
      { type: 'range', params: { min: 0, max: 120 } },
    ],
  },
];

const results = validateDocument(extractedData, fields);
// results['field-1'].valid === true
// results['field-2'].valid === true
```

## Error Messages

All validation errors include:
- **rule**: The validation rule type that failed
- **message**: A descriptive error message
- **value**: The value that failed validation

**Example error messages:**
- Required: "Field is required and cannot be empty"
- Format: "Value does not match email address format"
- Range: "Value 150 is greater than maximum 100"
- Regex: "Value does not match pattern: ^INV-\\d{6}$"
- Date Format: "Value does not match ISO 8601 date format"

## Usage in Processing Pipeline

The validation engine is used in the document processing pipeline:

1. **Document Upload**: Customer uploads document
2. **Textract Processing**: Extract text and data
3. **Field Extraction**: Apply template rules to extract field values
4. **Validation**: Apply validation rules to extracted values ← **Validation Engine**
5. **Storage**: Store extracted data with validation results

**Integration example:**
```typescript
import { validateDocument } from './validation';
import { Field, ExtractedData } from './data-models';

// In the ValidateFields Lambda
const documentType = await getDocumentType(documentTypeId);
const extractedData = event.extractedData;

const results = validateDocument(
  extractedData,
  documentType.schema.fields
);

// Check if any field failed validation
const hasErrors = Object.values(results).some(r => !r.valid);

if (hasErrors) {
  // Collect validation errors
  const validationErrors = [];
  for (const [fieldId, result] of Object.entries(results)) {
    if (!result.valid) {
      const field = documentType.schema.fields.find(f => f.fieldId === fieldId);
      for (const error of result.errors) {
        validationErrors.push({
          fieldId,
          fieldName: field.name,
          value: extractedData[fieldId],
          rule: error.rule,
          message: error.message,
        });
      }
    }
  }
  
  // Store document with validation errors
  await storeDocument({
    ...document,
    status: 'completed',
    validationErrors,
  });
}
```

## Testing

The validation engine includes comprehensive unit tests covering:

- **Specific examples**: Concrete test cases for each validator
- **Edge cases**: Boundary values, empty inputs, special characters
- **Error conditions**: Invalid parameters, malformed patterns
- **Multiple rules**: Testing rule combinations

**Test coverage:**
- 60 unit tests
- All validators tested with positive and negative cases
- Edge cases for numeric boundaries, unicode, long strings
- Integration tests for multi-rule validation

**Run tests:**
```bash
npm test -- validation.test.ts
```

## Files

- `validation.ts`: Validation engine implementation
- `validation.test.ts`: Unit tests
- `data-models.ts`: Type definitions for ValidationRule, Field, etc.

## Requirements Traceability

- **Requirement 3.1**: Required field validator
- **Requirement 3.2**: Format validator
- **Requirement 3.3**: Range validator
- **Requirement 3.4**: Regex validator
- **Requirement 3.5**: Date format validator
- **Requirement 3.6**: Validation error recording
- **Requirement 3.7**: Multiple validation rules per field
