# Document Upload Service

This module implements the document upload functionality for Phase 2 of the Multi-Tenant Document Platform.

## Overview

The Document Upload Service handles:
- File format validation (PDF, PNG, JPEG, TIFF)
- File size validation (max 10MB)
- Document storage in S3 with tenant isolation
- Metadata storage in DynamoDB
- Document lifecycle management

## Components

### DocumentService (`service.ts`)

Core service class that handles document operations:

**Key Methods:**
- `uploadDocument(request)` - Upload and validate a document
- `getDocument(customerId, documentId)` - Retrieve document metadata
- `listDocuments(customerId, options)` - List all documents for a customer
- `listDocumentsByStatus(customerId, status, options)` - Query documents by status
- `updateDocumentStatus(customerId, documentId, status)` - Update document status
- `storeExtractedData(customerId, documentId, data, errors)` - Store extraction results

**Validation:**
- Supported formats: PDF, PNG, JPEG, JPG, TIFF, TIF
- Maximum file size: 10MB
- File extension required

**S3 Storage:**
- Key format: `customers/{customerId}/documents/{documentId}.{ext}`
- Server-side encryption: AES256
- Tenant isolation via customer-prefixed keys

**DynamoDB Schema:**
```typescript
{
  PK: "CUSTOMER#{customerId}",
  SK: "DOCUMENT#{documentId}",
  GSI2PK: "CUSTOMER#{customerId}",
  GSI2SK: "STATUS#{status}#DOCUMENT#{documentId}",
  documentId: string,
  customerId: string,
  documentTypeId: string,
  templateId?: string,
  filename: string,
  fileSize: number,
  s3Key: string,
  s3Bucket: string,
  language: "en" | "fr" | "ar",
  status: "uploaded" | "processing" | "completed" | "failed" | "reviewed" | "approved",
  uploadedAt: string,
  processedAt?: string,
  extractedData?: ExtractedData,
  validationErrors?: ValidationError[],
  reviewedAt?: string,
  reviewedBy?: string
}
```

### Lambda Handler (`upload.ts`)

API Gateway Lambda handler for `POST /documents/upload`:

**Request Body:**
```json
{
  "documentTypeId": "dt-123",
  "templateId": "tmpl-456",  // optional
  "filename": "invoice.pdf",
  "fileContent": "base64-encoded-content",
  "language": "en"  // optional, defaults to "en"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "documentId": "doc-789",
    "s3Key": "customers/cust-123/documents/doc-789.pdf",
    "uploadedAt": "2024-01-15T10:00:00Z"
  }
}
```

**Error Responses:**
- `400 MISSING_BODY` - Request body is required
- `400 MISSING_FIELD` - Required field missing (documentTypeId, filename, fileContent)
- `400 INVALID_FORMAT` - Unsupported file format
- `400 FILE_TOO_LARGE` - File exceeds 10MB limit
- `500 UPLOAD_FAILED` - Internal server error

## Testing

### Unit Tests

**Service Tests (`service.test.ts`):**
- 26 tests covering all service methods
- File format validation (PDF, PNG, JPEG, JPG, TIFF, TIF)
- File size validation (boundary testing at 10MB)
- S3 upload with encryption
- DynamoDB metadata storage
- Tenant isolation (customer-prefixed S3 keys)
- Language support (default to English)
- Status management via GSI2

**Handler Tests (`upload.test.ts`):**
- 10 tests covering Lambda handler
- Request validation
- Error handling
- Auth context extraction
- Response formatting

### Running Tests

```bash
# Run all document service tests
npm test -- documents/

# Run specific test file
npm test -- documents/service.test.ts
npm test -- documents/upload.test.ts
```

## Requirements Validation

This implementation satisfies the following requirements from the design document:

- **Requirement 5.1**: File format validation (PDF, PNG, JPEG, TIFF) ✓
- **Requirement 5.2**: File size validation (max 10MB) ✓
- **Requirement 5.3**: Document storage in S3 with unique key ✓
- **Requirement 5.4**: S3 key tenant isolation (customer-prefixed) ✓
- **Requirement 5.5**: Metadata extraction (filename, size, timestamp, customer ID) ✓

## Usage Example

```typescript
import { DocumentService } from './service';

const service = new DocumentService();

// Upload a document
const result = await service.uploadDocument({
  customerId: 'cust-123',
  documentTypeId: 'dt-456',
  templateId: 'tmpl-789',
  filename: 'invoice.pdf',
  fileContent: Buffer.from('...'),
  fileSize: 1024,
  language: 'en',
});

console.log(result);
// {
//   documentId: 'doc-999',
//   s3Key: 'customers/cust-123/documents/doc-999.pdf',
//   uploadedAt: '2024-01-15T10:00:00Z'
// }

// Get document metadata
const document = await service.getDocument('cust-123', 'doc-999');

// List documents by status
const completed = await service.listDocumentsByStatus('cust-123', 'completed');
```

## Next Steps

After document upload, the processing pipeline will:
1. Pre-process the document (orientation correction, PDF page splitting)
2. Invoke AWS Textract for OCR and data extraction
3. Apply template extraction rules
4. Optionally enhance with AWS Bedrock (Claude)
5. Validate extracted data
6. Store results in DynamoDB

These steps will be implemented in subsequent tasks (Tasks 6-9).
