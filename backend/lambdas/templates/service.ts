// Template Service - Business Logic Layer
// Phase 2: Document Type & Template Management

import { v4 as uuidv4 } from 'uuid';
import {
  TemplateRepository,
  DocumentTypeRepository,
  generateCustomerPK,
  generateSK,
  validateTenantAccess,
} from '../layers/shared/nodejs/repository';

// ========================================
// Type Definitions
// ========================================

export type ExtractionMethod = 'textract_kv' | 'regex' | 'bbox' | 'table';

export interface Template {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  templateId: string;
  customerId: string;
  documentTypeId: string;
  name: string;
  description?: string;
  rules: ExtractionRule[];
  aiEnhanced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionRule {
  ruleId: string;
  fieldId: string;
  method: ExtractionMethod;
  params: ExtractionParams;
}

export type ExtractionParams =
  | TextractKVParams
  | RegexParams
  | BoundingBoxParams
  | TableParams;

export interface TextractKVParams {
  keyPattern: string;
  confidence?: number;
}

export interface RegexParams {
  pattern: string;
  captureGroup?: number;
  flags?: string;
}

export interface BoundingBoxParams {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface TableParams {
  tableIndex: number;
  columnMapping: Record<string, string>;
}

export interface CreateTemplateInput {
  documentTypeId: string;
  name: string;
  description?: string;
  rules?: ExtractionRule[];
  aiEnhanced?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  rules?: ExtractionRule[];
  aiEnhanced?: boolean;
}

// ========================================
// Validation Functions
// ========================================

/**
 * Validate extraction rule configuration
 */
export function validateExtractionRule(rule: ExtractionRule): void {
  if (!rule.fieldId) {
    throw new Error('Extraction rule must have a fieldId');
  }

  if (!rule.method) {
    throw new Error('Extraction rule must have a method');
  }

  const validMethods: ExtractionMethod[] = ['textract_kv', 'regex', 'bbox', 'table'];
  if (!validMethods.includes(rule.method)) {
    throw new Error(`Invalid extraction method: ${rule.method}`);
  }

  // Validate method-specific parameters
  switch (rule.method) {
    case 'textract_kv':
      validateTextractKVParams(rule.params as TextractKVParams);
      break;
    case 'regex':
      validateRegexParams(rule.params as RegexParams);
      break;
    case 'bbox':
      validateBoundingBoxParams(rule.params as BoundingBoxParams);
      break;
    case 'table':
      validateTableParams(rule.params as TableParams);
      break;
  }

  // Ensure rule has a ruleId
  if (!rule.ruleId) {
    rule.ruleId = uuidv4();
  }
}

/**
 * Validate Textract KV parameters
 */
function validateTextractKVParams(params: TextractKVParams): void {
  if (!params.keyPattern) {
    throw new Error('Textract KV rule must have a keyPattern');
  }

  if (params.confidence !== undefined) {
    if (params.confidence < 0 || params.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }
}

/**
 * Validate regex parameters
 */
function validateRegexParams(params: RegexParams): void {
  if (!params.pattern) {
    throw new Error('Regex rule must have a pattern');
  }

  // Test if regex is valid
  try {
    new RegExp(params.pattern, params.flags);
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${(error as Error).message}`);
  }

  if (params.captureGroup !== undefined && params.captureGroup < 0) {
    throw new Error('Capture group must be non-negative');
  }
}

/**
 * Validate bounding box parameters
 */
function validateBoundingBoxParams(params: BoundingBoxParams): void {
  if (params.x === undefined || params.y === undefined || 
      params.width === undefined || params.height === undefined) {
    throw new Error('Bounding box rule must have x, y, width, and height');
  }

  // Validate percentages (0-100)
  if (params.x < 0 || params.x > 100) {
    throw new Error('Bounding box x must be between 0 and 100');
  }
  if (params.y < 0 || params.y > 100) {
    throw new Error('Bounding box y must be between 0 and 100');
  }
  if (params.width < 0 || params.width > 100) {
    throw new Error('Bounding box width must be between 0 and 100');
  }
  if (params.height < 0 || params.height > 100) {
    throw new Error('Bounding box height must be between 0 and 100');
  }

  if (params.page !== undefined && params.page < 1) {
    throw new Error('Page number must be at least 1');
  }
}

/**
 * Validate table parameters
 */
function validateTableParams(params: TableParams): void {
  if (params.tableIndex === undefined) {
    throw new Error('Table rule must have a tableIndex');
  }

  if (params.tableIndex < 0) {
    throw new Error('Table index must be non-negative');
  }

  if (!params.columnMapping || Object.keys(params.columnMapping).length === 0) {
    throw new Error('Table rule must have a columnMapping');
  }
}

/**
 * Validate all extraction rules in a template
 */
export function validateExtractionRules(rules: ExtractionRule[]): void {
  if (!Array.isArray(rules)) {
    throw new Error('Rules must be an array');
  }

  for (const rule of rules) {
    validateExtractionRule(rule);
  }
}

// ========================================
// Template Service
// ========================================

export class TemplateService {
  private repository: TemplateRepository;
  private documentTypeRepository: DocumentTypeRepository;

  constructor(
    repository?: TemplateRepository,
    documentTypeRepository?: DocumentTypeRepository
  ) {
    this.repository = repository || new TemplateRepository();
    this.documentTypeRepository = documentTypeRepository || new DocumentTypeRepository();
  }

  /**
   * Create a new template
   */
  async createTemplate(
    customerId: string,
    input: CreateTemplateInput
  ): Promise<Template> {
    // Validate document type exists and belongs to customer
    const documentType = await this.documentTypeRepository.getById(
      customerId,
      input.documentTypeId
    );

    if (!documentType) {
      throw new Error(`Document type ${input.documentTypeId} not found`);
    }

    validateTenantAccess(documentType.customerId, customerId);

    // Validate extraction rules if provided
    if (input.rules && input.rules.length > 0) {
      validateExtractionRules(input.rules);
    }

    // Generate IDs and timestamps
    const templateId = uuidv4();
    const now = new Date().toISOString();

    // Create template object
    const template: Template = {
      PK: generateCustomerPK(customerId),
      SK: generateSK('TEMPLATE', templateId),
      GSI1PK: generateSK('DOCTYPE', input.documentTypeId),
      GSI1SK: generateSK('TEMPLATE', templateId),
      templateId,
      customerId,
      documentTypeId: input.documentTypeId,
      name: input.name,
      description: input.description,
      rules: input.rules || [],
      aiEnhanced: input.aiEnhanced || false,
      createdAt: now,
      updatedAt: now,
    };

    // Save to repository
    await this.repository.put(template);

    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplate(
    customerId: string,
    templateId: string
  ): Promise<Template | null> {
    const template = await this.repository.getById(customerId, templateId);

    if (!template) {
      return null;
    }

    // Validate tenant access
    validateTenantAccess(template.customerId, customerId);

    return template;
  }

  /**
   * List all templates for a customer
   */
  async listTemplates(
    customerId: string,
    options: { 
      limit?: number; 
      nextToken?: string;
      documentTypeId?: string;
    } = {}
  ): Promise<{ items: Template[]; nextToken?: string }> {
    // If filtering by document type, use GSI1
    if (options.documentTypeId) {
      const result = await this.repository.getByDocumentType(
        options.documentTypeId,
        {
          limit: options.limit,
          nextToken: options.nextToken,
        }
      );

      // Filter by customer ID for tenant isolation
      const filteredItems = result.items.filter(
        (template: Template) => template.customerId === customerId
      );

      return {
        items: filteredItems,
        nextToken: result.nextToken,
      };
    }

    // Otherwise, query by customer
    const result = await this.repository.getByCustomer(customerId, {
      limit: options.limit,
      nextToken: options.nextToken,
    });

    return {
      items: result.items,
      nextToken: result.nextToken,
    };
  }

  /**
   * Update a template
   */
  async updateTemplate(
    customerId: string,
    templateId: string,
    input: UpdateTemplateInput
  ): Promise<Template> {
    // Get existing template
    const existing = await this.getTemplate(customerId, templateId);
    if (!existing) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate tenant access
    validateTenantAccess(existing.customerId, customerId);

    // Prepare updates
    const updates: Partial<Template> = {
      updatedAt: new Date().toISOString(),
    };

    // Update name if provided
    if (input.name !== undefined) {
      updates.name = input.name;
    }

    // Update description if provided
    if (input.description !== undefined) {
      updates.description = input.description;
    }

    // Update rules if provided
    if (input.rules !== undefined) {
      validateExtractionRules(input.rules);
      updates.rules = input.rules;
    }

    // Update aiEnhanced if provided
    if (input.aiEnhanced !== undefined) {
      updates.aiEnhanced = input.aiEnhanced;
    }

    // Update in repository
    const updated = await this.repository.update(
      existing.PK,
      existing.SK,
      updates
    );

    return updated;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(
    customerId: string,
    templateId: string
  ): Promise<void> {
    // Get existing template
    const existing = await this.getTemplate(customerId, templateId);
    if (!existing) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate tenant access
    validateTenantAccess(existing.customerId, customerId);

    // Delete from repository
    await this.repository.delete(existing.PK, existing.SK);
  }

  /**
   * Add an extraction rule to a template
   */
  async addRule(
    customerId: string,
    templateId: string,
    rule: ExtractionRule
  ): Promise<Template> {
    // Get existing template
    const existing = await this.getTemplate(customerId, templateId);
    if (!existing) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate tenant access
    validateTenantAccess(existing.customerId, customerId);

    // Validate the rule
    validateExtractionRule(rule);

    // Check if rule with same ruleId already exists
    const existingRuleIndex = existing.rules.findIndex(r => r.ruleId === rule.ruleId);
    if (existingRuleIndex !== -1) {
      throw new Error(`Rule with ID ${rule.ruleId} already exists in template`);
    }

    // Add the rule
    const updatedRules = [...existing.rules, rule];

    // Update the template
    const updates: Partial<Template> = {
      rules: updatedRules,
      updatedAt: new Date().toISOString(),
    };

    const updated = await this.repository.update(
      existing.PK,
      existing.SK,
      updates
    );

    return updated;
  }

  /**
   * Remove an extraction rule from a template
   */
  async removeRule(
    customerId: string,
    templateId: string,
    ruleId: string
  ): Promise<Template> {
    // Get existing template
    const existing = await this.getTemplate(customerId, templateId);
    if (!existing) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate tenant access
    validateTenantAccess(existing.customerId, customerId);

    // Find the rule
    const ruleIndex = existing.rules.findIndex(r => r.ruleId === ruleId);
    if (ruleIndex === -1) {
      throw new Error(`Rule with ID ${ruleId} not found in template`);
    }

    // Remove the rule
    const updatedRules = existing.rules.filter(r => r.ruleId !== ruleId);

    // Update the template
    const updates: Partial<Template> = {
      rules: updatedRules,
      updatedAt: new Date().toISOString(),
    };

    const updated = await this.repository.update(
      existing.PK,
      existing.SK,
      updates
    );

    return updated;
  }
}
