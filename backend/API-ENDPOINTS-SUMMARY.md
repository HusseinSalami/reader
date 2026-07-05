# API Endpoints Summary - Phase 2

## Overview

This document provides a complete reference for all Phase 2 API endpoints implemented for the Document Type & Template Management system.

## Base URL

```
https://{api-id}.execute-api.{region}.amazonaws.com/prod
```

## Authentication

All endpoints under `/v1` require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt-token>
```

## Document Type Endpoints

### Create Document Type
```http
POST /v1/document-types
```

**Request Body:**
```json
{
  "name": "Invoice",
  "description": "Standard invoice documents",
  "schema": {
    "fields": [
      {
        "name": "invoice_number",
        "dataType": "text",
        "required": true,
        "validationRules": [
          {
            "type": "regex",
            "params": {
              "pattern": "^INV-\\d{6}$"
            }
          }
        ]
      }
    ]
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "documentTypeId": "dt-456",
    "customerId": "cust-123",
    "name": "Invoice",
    "description": "Standard invoice documents",
    "schema": { ... },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### List Document Types
```http
GET /v1/document-types?limit=10&nextToken=abc123
```

**Query Parameters:**
- `limit` (optional): Maximum number of results (default: 50)
- `nextToken` (optional): Pagination token

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "nextToken": "xyz789",
    "count": 10
  }
}
```

### Get Document Type
```http
GET /v1/document-types/{id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "documentTypeId": "dt-456",
    "name": "Invoice",
    ...
  }
}
```

### Update Document Type
```http
PUT /v1/document-types/{id}
```

**Request Body:**
```json
{
  "description": "Updated description"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "documentTypeId": "dt-456",
    "updatedAt": "2024-01-15T11:30:00Z",
    ...
  }
}
```

### Delete Document Type
```http
DELETE /v1/document-types/{id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Document type deleted successfully"
}
```

## Template Endpoints

### Create Template
```http
POST /v1/templates
```

**Request Body:**
```json
{
  "documentTypeId": "dt-456",
  "name": "Invoice Template",
  "description": "Template for extracting invoice data",
  "rules": [
    {
      "fieldId": "field-1",
      "method": "textract_kv",
      "params": {
        "keyPattern": "Invoice Number",
        "confidence": 0.8
      }
    },
    {
      "fieldId": "field-2",
      "method": "regex",
      "params": {
        "pattern": "Total:\\s*\\$([\\d,]+\\.\\d{2})",
        "captureGroup": 1
      }
    }
  ],
  "aiEnhanced": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "templateId": "tmpl-789",
    "customerId": "cust-123",
    "documentTypeId": "dt-456",
    "name": "Invoice Template",
    "rules": [ ... ],
    "aiEnhanced": false,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### List Templates
```http
GET /v1/templates?documentTypeId=dt-456&limit=10&nextToken=abc123
```

**Query Parameters:**
- `documentTypeId` (optional): Filter by document type
- `limit` (optional): Maximum number of results
- `nextToken` (optional): Pagination token

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "nextToken": "xyz789",
    "count": 10
  }
}
```

### Get Template
```http
GET /v1/templates/{id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "templateId": "tmpl-789",
    "name": "Invoice Template",
    "rules": [ ... ],
    ...
  }
}
```

### Update Template
```http
PUT /v1/templates/{id}
```

**Request Body:**
```json
{
  "name": "Updated Invoice Template",
  "aiEnhanced": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "templateId": "tmpl-789",
    "updatedAt": "2024-01-15T11:30:00Z",
    ...
  }
}
```

### Delete Template
```http
DELETE /v1/templates/{id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

## Document Endpoints

### Upload Document
```http
POST /v1/documents/upload-new
```

**Request Body:**
```json
{
  "documentTypeId": "dt-456",
  "templateId": "tmpl-789",
  "filename": "invoice.pdf",
  "fileContent": "base64-encoded-content",
  "language": "en"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "documentId": "doc-999",
    "s3Key": "customers/cust-123/documents/doc-999.pdf",
    "uploadedAt": "2024-01-15T10:00:00Z"
  }
}
```

### List Documents
```http
GET /v1/documents?status=completed&limit=10&nextToken=abc123
```

**Query Parameters:**
- `status` (optional): Filter by status (uploaded, processing, completed, failed, reviewed, approved)
- `limit` (optional): Maximum number of results
- `nextToken` (optional): Pagination token

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "documentId": "doc-999",
        "filename": "invoice.pdf",
        "status": "completed",
        "uploadedAt": "2024-01-15T10:00:00Z",
        ...
      }
    ],
    "nextToken": "xyz789",
    "count": 10
  }
}
```

### Get Document
```http
GET /v1/documents/{id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "documentId": "doc-999",
    "customerId": "cust-123",
    "documentTypeId": "dt-456",
    "templateId": "tmpl-789",
    "filename": "invoice.pdf",
    "status": "completed",
    "extractedData": {
      "fields": {
        "field-1": {
          "fieldId": "field-1",
          "value": "INV-123456",
          "confidence": 0.95,
          "source": "textract",
          "corrected": false
        }
      }
    },
    "validationErrors": [],
    "uploadedAt": "2024-01-15T10:00:00Z",
    "processedAt": "2024-01-15T10:01:30Z"
  }
}
```

### Review Document
```http
PUT /v1/documents/{id}/review
```

**Request Body:**
```json
{
  "extractedData": {
    "fields": {
      "field-1": {
        "fieldId": "field-1",
        "value": "INV-123456-CORRECTED",
        "confidence": 1.0,
        "source": "manual",
        "corrected": true
      }
    }
  },
  "validationErrors": []
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "documentId": "doc-999",
    "extractedData": { ... },
    ...
  }
}
```

### Approve Document
```http
POST /v1/documents/{id}/approve
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Document approved successfully",
  "document": {
    "documentId": "doc-999",
    "status": "approved",
    ...
  }
}
```

### Reject Document
```http
POST /v1/documents/{id}/reject
```

**Request Body (optional):**
```json
{
  "reason": "Incorrect data extraction"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Document rejected successfully",
  "reason": "Incorrect data extraction",
  "document": {
    "documentId": "doc-999",
    "status": "failed",
    ...
  }
}
```

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name, description, and schema are required"
  }
}
```

### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Customer ID not found in authorization context"
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied: Resource belongs to another customer"
  }
}
```

### 404 Not Found
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### 409 Conflict
```json
{
  "error": {
    "code": "DUPLICATE_NAME",
    "message": "Resource with this name already exists"
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

## Extraction Methods

Templates support 4 extraction methods:

### 1. Textract Key-Value
```json
{
  "method": "textract_kv",
  "params": {
    "keyPattern": "Invoice Number",
    "confidence": 0.8
  }
}
```

### 2. Regex
```json
{
  "method": "regex",
  "params": {
    "pattern": "Total:\\s*\\$([\\d,]+\\.\\d{2})",
    "captureGroup": 1,
    "flags": "i"
  }
}
```

### 3. Bounding Box
```json
{
  "method": "bbox",
  "params": {
    "x": 10,
    "y": 20,
    "width": 30,
    "height": 40,
    "page": 1
  }
}
```

### 4. Table
```json
{
  "method": "table",
  "params": {
    "tableIndex": 0,
    "columnMapping": {
      "Item": "item_name",
      "Quantity": "quantity",
      "Price": "price"
    }
  }
}
```

## Validation Rules

Fields support 5 validation rule types:

### 1. Required
```json
{
  "type": "required",
  "params": {}
}
```

### 2. Format
```json
{
  "type": "format",
  "params": {
    "pattern": "email"
  }
}
```

### 3. Range
```json
{
  "type": "range",
  "params": {
    "min": 0,
    "max": 1000000
  }
}
```

### 4. Regex
```json
{
  "type": "regex",
  "params": {
    "pattern": "^INV-\\d{6}$"
  }
}
```

### 5. Date Format
```json
{
  "type": "dateFormat",
  "params": {
    "format": "YYYY-MM-DD"
  }
}
```

## Rate Limits

- Document upload: 1 request per minute per customer
- All other endpoints: No specific rate limits (AWS API Gateway default: 10,000 requests per second)

## CORS Configuration

All endpoints support CORS with:
- **Allowed Origins**: `*` (all origins)
- **Allowed Methods**: All methods (GET, POST, PUT, DELETE, OPTIONS)
- **Allowed Headers**: `Content-Type`, `Authorization`, `X-Api-Key`

## Security

- All endpoints require JWT authentication
- Customer ID is extracted from JWT token
- Tenant isolation enforced at all levels
- Cross-tenant access blocked with 403 Forbidden
- Input validation and sanitization applied
- IAM permissions follow least-privilege principle

