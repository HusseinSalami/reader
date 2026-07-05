# Shared Data Access Layer

This directory contains the shared data access layer for Phase 2 of the Multi-Tenant Document Platform: Document Type & Template Management.

## Overview

The data access layer provides:
- **Single Table Design**: Unified DynamoDB table with PK/SK pattern for all entities
- **Tenant Isolation**: Built-in customer ID filtering for multi-tenancy
- **Type-Safe Models**: TypeScript interfaces for all data structures
- **Base Repository**: Common CRUD operations with GSI support
- **Specialized Repositories**: Domain-specific repositories for Document Types, Templates, and Documents

## Files

### `data-models.ts`
Defines all TypeScript interfaces and types for:
- Document Types and Extraction Schemas
- Templates and Extraction Rules
- Documents and Extracted Data
- Validation Rules and Errors
- Textract Integration Types

### `repository.ts`
Provides base repository class and specialized repositories:
- `BaseRepository<T>`: Generic CRUD operations
- `DocumentTypeRepository`: Document type management with cascading deletes
- `TemplateRepository`: Template management with document type queries
- `DocumentRepository`: Document management with status queries

### `types.ts` (Phase 1)
Legacy types from Phase 1 (customer management, authentication)

### `utils.ts` (Phase 1)
Legacy utilities from Phase 1 (API responses, auth context)

## DynamoDB Table Structure

### Table: `DocumentPlatform`

**Primary Key:**
- `PK` (String): Partition key - `CUSTOMER#{customerId}`
- `SK` (String): Sort key - `{PREFIX}#{id}`

**Global Secondary Indexes:**
- **GSI1**: Query by document type
  - `GSI1PK`: `DOCTYPE#{documentTypeId}`
  - `GSI1SK`: `TEMPLATE#{templateId}`
- **GSI2**: Query by status
  - `GSI2PK`: `CUSTOMER#{customerId}`
  - `GSI2SK`: `STATUS#{status}#DOCUMENT#{documentId}`

### Access Patterns

1. **Get all document types for a customer**
   ```typescript
   PK = CUSTOMER#{customerId}
   SK begins_with DOCTYPE#
   ```

2. **Get specific document type**
   ```typescript
   PK = CUSTOMER#{customerId}
   SK = DOCTYPE#{documentTypeId}
   ```

3. **Get all templates for a customer**
   ```typescript
   PK = CUSTOMER#{customerId}
   SK begins_with TEMPLATE#
   ```

4. **Get templates by document type (GSI1)**
   ```typescript
   GSI1PK = DOCTYPE#{documentTypeId}
   GSI1SK begins_with TEMPLATE#
   ```

5. **Get all documents for a customer**
   ```typescript
   PK = CUSTOMER#{customerId}
   SK begins_with DOCUMENT#
   ```

6. **Get documents by status (GSI2)**
   ```typescript
   GSI2PK = CUSTOMER#{customerId}
   GSI2SK begins_with STATUS#{status}
   ```

## Usage Examples

### Document Type Repository

```typescript
import { DocumentTypeRepository, generateCustomerPK, generateSK } from './repository';
import { DocumentType } from './data-models';

const repo = new DocumentTypeRepository();

// Create a document type
const documentType: DocumentType = {
  PK: generateCustomerPK('cust-123'),
  SK: generateSK('DOCTYPE', 'dt-456'),
  documentTypeId: 'dt-456',
  customerId: 'cust-123',
  name: 'Invoice',
  description: 'Standard invoice documents',
  schema: {
    fields: [
      {
        fieldId: 'field-1',
        name: 'invoice_number',
        dataType: 'text',
        required: true,
        validationRules: [
          { type: 'regex', params: { pattern: '^INV-\\d{6}$' } }
        ]
      }
    ]
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

await repo.put(documentType);

// Get all document types for a customer
const result = await repo.getByCustomer('cust-123');
console.log(result.items); // Array of document types

// Get specific document type
const docType = await repo.getById('cust-123', 'dt-456');

// Delete with cascading (removes templates and documents)
await repo.deleteWithCascade('cust-123', 'dt-456');
```

### Template Repository

```typescript
import { TemplateRepository, generateCustomerPK, generateSK } from './repository';
import { Template } from './data-models';

const repo = new TemplateRepository();

// Create a template
const template: Template = {
  PK: generateCustomerPK('cust-123'),
  SK: generateSK('TEMPLATE', 'tmpl-789'),
  GSI1PK: generateSK('DOCTYPE', 'dt-456'),
  GSI1SK: generateSK('TEMPLATE', 'tmpl-789'),
  templateId: 'tmpl-789',
  customerId: 'cust-123',
  documentTypeId: 'dt-456',
  name: 'Standard Invoice Template',
  rules: [
    {
      ruleId: 'rule-1',
      fieldId: 'field-1',
      method: 'textract_kv',
      params: { keyPattern: 'Invoice Number', confidence: 0.8 }
    }
  ],
  aiEnhanced: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

await repo.put(template);

// Get templates by document type (uses GSI1)
const templates = await repo.getByDocumentType('dt-456');
console.log(templates.items); // Array of templates for this document type
```

### Document Repository

```typescript
import { DocumentRepository, generateCustomerPK, generateSK } from './repository';
import { Document } from './data-models';

const repo = new DocumentRepository();

// Create a document
const document: Document = {
  PK: generateCustomerPK('cust-123'),
  SK: generateSK('DOCUMENT', 'doc-999'),
  GSI2PK: generateCustomerPK('cust-123'),
  GSI2SK: `STATUS#completed#DOCUMENT#doc-999`,
  documentId: 'doc-999',
  customerId: 'cust-123',
  documentTypeId: 'dt-456',
  templateId: 'tmpl-789',
  filename: 'invoice_2024_001.pdf',
  fileSize: 245678,
  s3Key: 'customers/cust-123/documents/doc-999.pdf',
  s3Bucket: 'document-platform-docs',
  language: 'en',
  status: 'completed',
  uploadedAt: new Date().toISOString(),
  processedAt: new Date().toISOString(),
  extractedData: {
    fields: {
      'field-1': {
        fieldId: 'field-1',
        value: 'INV-123456',
        confidence: 0.95,
        source: 'textract',
        corrected: false
      }
    }
  },
  validationErrors: []
};

await repo.put(document);

// Get documents by status (uses GSI2)
const completedDocs = await repo.getByStatus('cust-123', 'completed');
console.log(completedDocs.items); // Array of completed documents
```

## Tenant Isolation

All repositories enforce tenant isolation automatically:

```typescript
import { validateTenantAccess, filterByCustomer } from './repository';

// Validate access before operations
validateTenantAccess(resourceCustomerId, requestCustomerId);
// Throws error if customer IDs don't match

// Filter items by customer
const customerItems = filterByCustomer(allItems, customerId);
// Returns only items belonging to the customer
```

## Environment Variables

- `TABLE_NAME`: DynamoDB table name (default: `DocumentPlatform`)

## Testing

Unit tests are located in `tests/unit/repository.test.ts` and cover:
- Tenant isolation helpers
- Base repository operations
- Specialized repository methods
- Key generation and parsing
- Access validation

Run tests:
```bash
npm test
```

## Design Principles

1. **Single Table Design**: All entities in one table for efficient queries
2. **Tenant Isolation**: Customer ID prefix on all partition keys
3. **Type Safety**: Full TypeScript support with strict types
4. **Composable**: Base repository provides common operations, specialized repositories add domain logic
5. **Testable**: Mocked DynamoDB client for unit testing
6. **Scalable**: GSIs enable efficient queries without table scans

## Next Steps

This data access layer is the foundation for:
- Task 2: Document Type Service (CRUD operations)
- Task 3: Validation Rules Engine
- Task 5: Template Service
- Task 6: Document Upload Service
