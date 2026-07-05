// Validate Fields Lambda
// Applies validation rules to extracted field values

import { validateField } from '../layers/shared/nodejs/validation';

interface ValidateFieldsEvent {
  documentId: string;
  customerId: string;
  documentType: any;
  extractedData: any;
}

export const handler = async (event: ValidateFieldsEvent) => {
  console.log('Validating fields:', event.documentId);

  try {
    const validationErrors: any[] = [];
    const { documentType, extractedData } = event;

    // Validate each field
    for (const field of documentType.schema.fields) {
      const extractedField = extractedData.fields[field.fieldId];
      const value = extractedField?.value?.value || extractedField?.value;

      // Apply validation rules
      for (const rule of field.validationRules || []) {
        // Skip validation if rule is null/undefined
        if (!rule || !rule.type) {
          console.warn(`Skipping invalid rule for field ${field.fieldId}:`, rule);
          continue;
        }

        const result = validateField(value, rule);
        
        if (!result.valid) {
          // Add all errors from this rule
          for (const error of result.errors) {
            validationErrors.push({
              fieldId: field.fieldId,
              fieldName: field.name,
              value,
              rule: error.rule,
              message: error.message,
            });
          }
        }
      }
    }

    return {
      ...event,
      validationErrors,
      validationPassed: validationErrors.length === 0,
    };
  } catch (error: any) {
    console.error('Validation failed:', error);
    throw new Error(`Validation failed: ${error.message}`);
  }
};
