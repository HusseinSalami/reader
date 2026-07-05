// Document Type Service - Business Logic Layer
// Phase 2: Document Type & Template Management

import { v4 as uuidv4 } from 'uuid';
import {
  DocumentTypeRepository,
  generateCustomerPK,
  generateSK,
  validateTenantAccess,
} from '../layers/shared/nodejs/repository';

// ========================================
// Type Definitions
// ========================================

export type FieldDataType = 'text' | 'number' | 'date' | 'boolean' | 'table' | 'array';
export type ValidationType = 'required' | 'format' | 'range' | 'regex' | 'dateFormat';

export interface DocumentType {
  PK: string;
  SK: string;
  documentTypeId: string;
  customerId: string;
  name: string;
  description: string;
  schema: ExtractionSchema;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionSchema {
  fields: Field[];
}

export interface Field {
  fieldId: string;
  name: string;
  dataType: FieldDataType;
  description?: string;
  required: boolean;
  validationRules: ValidationRule[];
  tableConfig?: TableConfig;
}

export interface TableConfig {
  columns: TableColumn[];
}

export interface TableColumn {
  name: string;
  dataType: FieldDataType;
}

export interface ValidationRule {
  type: ValidationType;
  params: Record<string, any>;
}

export interface CreateDocumentTypeInput {
  name: string;
  description: string;
  schema: ExtractionSchema;
}

export interface UpdateDocumentTypeInput {
  name?: string;
  description?: string;
  schema?: ExtractionSchema;
}

// ========================================
// Validation Functions
// ========================================

/**
 * Sanitize document type name (alphanumeric, hyphens, underscores only)
 */
export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_\s]/g, '');
}

/**
 * Validate field ID (alphanumeric, hyphens, underscores only)
 */
export function validateFieldId(fieldId: string): void {
  const validPattern = /^[a-zA-Z0-9\-_]+$/;
  if (!validPattern.test(fieldId)) {
    throw new Error(
      `Invalid field ID "${fieldId}". Field IDs must contain only alphanumeric characters, hyphens, and underscores.`
    );
  }
}

/**
 * Validate schema structure
 */
export function validateSchema(schema: ExtractionSchema): void {
  if (!schema.fields || !Array.isArray(schema.fields)) {
    throw new Error('Schema must contain a fields array');
  }

  // Check for duplicate field names
  const fieldNames = new Set<string>();
  const fieldIds = new Set<string>();
  
  for (const field of schema.fields) {
    if (!field.name) {
      throw new Error('All fields must have a name');
    }

    if (!field.fieldId) {
      throw new Error('All fields must have a fieldId');
    }

    // Validate field ID (not display name)
    validateFieldId(field.fieldId);

    // Check for duplicate field IDs
    if (fieldIds.has(field.fieldId)) {
      throw new Error(`Duplicate field ID: ${field.fieldId}`);
    }
    fieldIds.add(field.fieldId);

    // Check for duplicate display names (warning, not error)
    if (fieldNames.has(field.name)) {
      console.warn(`Duplicate field name: ${field.name}`);
    }
    fieldNames.add(field.name);

    // Validate field data type
    const validDataTypes: FieldDataType[] = ['text', 'number', 'date', 'boolean', 'table', 'array'];
    if (!validDataTypes.includes(field.dataType)) {
      throw new Error(`Invalid data type for field ${field.name}: ${field.dataType}`);
    }

    // Validate table config if provided (optional for table fields)
    if (field.dataType === 'table' && field.tableConfig) {
      if (!field.tableConfig.columns || field.tableConfig.columns.length === 0) {
        throw new Error(`Table field ${field.name} tableConfig must have columns`);
      }

      // Validate column names
      const columnNames = new Set<string>();
      for (const column of field.tableConfig.columns) {
        if (!column.name) {
          throw new Error(`All columns in table field ${field.name} must have a name`);
        }
        if (columnNames.has(column.name)) {
          throw new Error(`Duplicate column name in table field ${field.name}: ${column.name}`);
        }
        columnNames.add(column.name);

        if (!validDataTypes.includes(column.dataType)) {
          throw new Error(`Invalid data type for column ${column.name} in table field ${field.name}: ${column.dataType}`);
        }
      }
    }

    // Ensure field has a fieldId
    if (!field.fieldId) {
      throw new Error(`Field "${field.name}" is missing fieldId`);
    }
  }
}

/**
 * Check for duplicate document type name within customer
 */
async function checkDuplicateName(
  repository: DocumentTypeRepository,
  customerId: string,
  name: string,
  excludeDocumentTypeId?: string
): Promise<void> {
  const result = await repository.getByCustomer(customerId);
  const duplicate = result.items.find(
    (dt: DocumentType) => 
      dt.name.toLowerCase() === name.toLowerCase() && 
      dt.documentTypeId !== excludeDocumentTypeId
  );

  if (duplicate) {
    throw new Error(`Document type with name "${name}" already exists`);
  }
}

// ========================================
// Document Type Service
// ========================================

export class DocumentTypeService {
  private repository: DocumentTypeRepository;

  constructor(repository?: DocumentTypeRepository) {
    this.repository = repository || new DocumentTypeRepository();
  }

  /**
   * Create a new document type
   */
  async createDocumentType(
    customerId: string,
    input: CreateDocumentTypeInput
  ): Promise<DocumentType> {
    // Sanitize name
    const sanitizedName = sanitizeName(input.name);
    if (!sanitizedName) {
      throw new Error('Document type name cannot be empty after sanitization');
    }

    // Check for duplicate name
    await checkDuplicateName(this.repository, customerId, sanitizedName);

    // Validate schema
    validateSchema(input.schema);

    // Generate IDs and timestamps
    const documentTypeId = uuidv4();
    const now = new Date().toISOString();

    // Create document type object
    const documentType: DocumentType = {
      PK: generateCustomerPK(customerId),
      SK: generateSK('DOCTYPE', documentTypeId),
      documentTypeId,
      customerId,
      name: sanitizedName,
      description: input.description,
      schema: input.schema,
      createdAt: now,
      updatedAt: now,
    };

    // Save to repository
    await this.repository.put(documentType);

    return documentType;
  }

  /**
   * Get document type by ID
   */
  async getDocumentType(
    customerId: string,
    documentTypeId: string
  ): Promise<DocumentType | null> {
    const documentType = await this.repository.getById(customerId, documentTypeId);
    
    if (!documentType) {
      return null;
    }

    // Validate tenant access
    validateTenantAccess(documentType.customerId, customerId);

    return documentType;
  }

  /**
   * List all document types for a customer
   */
  async listDocumentTypes(
    customerId: string,
    options: { limit?: number; nextToken?: string } = {}
  ): Promise<{ items: DocumentType[]; nextToken?: string }> {
    const result = await this.repository.getByCustomer(customerId, options);
    
    return {
      items: result.items,
      nextToken: result.nextToken,
    };
  }

  /**
   * Update a document type
   */
  async updateDocumentType(
    customerId: string,
    documentTypeId: string,
    input: UpdateDocumentTypeInput
  ): Promise<DocumentType> {
    // Get existing document type
    const existing = await this.getDocumentType(customerId, documentTypeId);
    if (!existing) {
      throw new Error(`Document type ${documentTypeId} not found`);
    }

    // Validate tenant access
    validateTenantAccess(existing.customerId, customerId);

    // Prepare updates
    const updates: Partial<DocumentType> = {
      updatedAt: new Date().toISOString(),
    };

    // Update name if provided
    if (input.name !== undefined) {
      const sanitizedName = sanitizeName(input.name);
      if (!sanitizedName) {
        throw new Error('Document type name cannot be empty after sanitization');
      }

      // Check for duplicate name (excluding current document type)
      await checkDuplicateName(this.repository, customerId, sanitizedName, documentTypeId);

      updates.name = sanitizedName;
    }

    // Update description if provided
    if (input.description !== undefined) {
      updates.description = input.description;
    }

    // Update schema if provided
    if (input.schema !== undefined) {
      validateSchema(input.schema);
      updates.schema = input.schema;
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
   * Delete a document type with cascading deletes
   */
  async deleteDocumentType(
    customerId: string,
    documentTypeId: string
  ): Promise<void> {
    // Get existing document type
    const existing = await this.getDocumentType(customerId, documentTypeId);
    if (!existing) {
      throw new Error(`Document type ${documentTypeId} not found`);
    }

    // Validate tenant access
    validateTenantAccess(existing.customerId, customerId);

    // Delete with cascade (removes templates and documents)
    await this.repository.deleteWithCascade(customerId, documentTypeId);
  }
}
