// Create Document Type Lambda Handler

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DocumentTypeService, CreateDocumentTypeInput } from './service';
import { TemplateService } from '../templates/service';
import { successResponse, errorResponse } from '../layers/shared/nodejs/utils';

/**
 * Lambda handler for creating a document type
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Extract customer ID from authorizer context
    const customerId = event.requestContext.authorizer?.customerId;
    if (!customerId) {
      return errorResponse('UNAUTHORIZED', 'Customer ID not found in authorization context', 401);
    }

    // Parse request body
    if (!event.body) {
      return errorResponse('INVALID_REQUEST', 'Request body is required', 400);
    }

    const input: CreateDocumentTypeInput & { aiEnhanced?: boolean } = JSON.parse(event.body);

    // Validate required fields
    if (!input.name || !input.description || !input.schema) {
      return errorResponse('VALIDATION_ERROR', 'Name, description, and schema are required', 400);
    }

    // Create document type
    const documentTypeService = new DocumentTypeService();
    const documentType = await documentTypeService.createDocumentType(customerId, input);

    // Auto-create default template
    try {
      const templateService = new TemplateService();
      
      // Generate default extraction rules for each field
      const defaultRules = input.schema.fields.map((field, index) => ({
        ruleId: `rule-${field.fieldId}`,
        fieldId: field.fieldId,
        method: 'textract_kv' as const,
        params: {
          keywords: [field.name, field.fieldId],
          confidence: 0.8
        }
      }));

      const defaultTemplate = await templateService.createTemplate(customerId, {
        documentTypeId: documentType.documentTypeId,
        name: `${documentType.name} - Default Template`,
        description: `Auto-generated template for ${documentType.name}`,
        rules: defaultRules,
        aiEnhanced: input.aiEnhanced ?? true // Default to AI-enhanced
      });

      console.log('Auto-created default template:', defaultTemplate.templateId);
    } catch (templateError) {
      console.error('Failed to auto-create template (non-fatal):', templateError);
      // Don't fail the document type creation if template creation fails
    }

    return successResponse(documentType, 201);
  } catch (error: any) {
    console.error('Error creating document type:', error);

    // Handle specific error types
    if (error.message.includes('already exists')) {
      return errorResponse('DUPLICATE_NAME', error.message, 409);
    }

    if (error.message.includes('Invalid') || error.message.includes('Duplicate')) {
      return errorResponse('VALIDATION_ERROR', error.message, 400);
    }

    return errorResponse('INTERNAL_ERROR', 'Failed to create document type', 500);
  }
}
