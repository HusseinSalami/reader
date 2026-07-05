# Document Platform API Structure

## API Endpoints Overview

### Base URL
```
https://{api-id}.execute-api.us-east-1.amazonaws.com/prod
```

## Authentication Endpoints (Public)

```
POST /auth/register
POST /auth/login
```

## Protected Endpoints (JWT Required)

All endpoints under `/v1` require JWT authentication via the `Authorization` header.

### Customer Management

```
GET    /v1/customers/me          # Get current customer profile
PUT    /v1/customers/me          # Update customer profile
```

### Document Type Management (Phase 2 - NEW)

```
POST   /v1/document-types        # Create document type
GET    /v1/document-types        # List document types
GET    /v1/document-types/{id}   # Get document type by ID
PUT    /v1/document-types/{id}   # Update document type
DELETE /v1/document-types/{id}   # Delete document type
```

### Document Management

```
POST   /v1/documents/upload      # Get presigned URL for document upload
```

## API Gateway Configuration

### CORS Settings
- **Allowed Origins**: `*` (all origins)
- **Allowed Methods**: All methods (GET, POST, PUT, DELETE, OPTIONS)
- **Allowed Headers**: `Content-Type`, `Authorization`, `X-Api-Key`

### Authorization
- **Type**: Custom JWT Authorizer
- **Token Source**: `Authorization` header
- **Cache TTL**: 5 minutes
- **Context**: Extracts `customerId` from JWT token

## Lambda Functions

### Phase 1 (Existing)
- `AuthorizerFunction` - JWT token validation
- `RegisterFunction` - Customer registration
- `LoginFunction` - Customer login
- `GetProfileFunction` - Get customer profile
- `UpdateProfileFunction` - Update customer profile
- `UploadUrlFunction` - Generate presigned S3 URL

### Phase 2 (New - Document Types)
- `CreateDocumentTypeFunction` - Create document type
- `ListDocumentTypesFunction` - List document types
- `GetDocumentTypeFunction` - Get document type
- `UpdateDocumentTypeFunction` - Update document type
- `DeleteDocumentTypeFunction` - Delete document type

## Request/Response Examples

### Create Document Type

**Request:**
```http
POST /v1/document-types HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

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
      },
      {
        "name": "total_amount",
        "dataType": "number",
        "required": true,
        "validationRules": [
          {
            "type": "range",
            "params": {
              "min": 0,
              "max": 1000000
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
    "PK": "CUSTOMER#cust-123",
    "SK": "DOCTYPE#dt-456",
    "documentTypeId": "dt-456",
    "customerId": "cust-123",
    "name": "Invoice",
    "description": "Standard invoice documents",
    "schema": {
      "fields": [...]
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### List Document Types

**Request:**
```http
GET /v1/document-types?limit=10 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "documentTypeId": "dt-456",
        "name": "Invoice",
        "description": "Standard invoice documents",
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "nextToken": null,
    "count": 1
  }
}
```

### Get Document Type

**Request:**
```http
GET /v1/document-types/dt-456 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "documentTypeId": "dt-456",
    "customerId": "cust-123",
    "name": "Invoice",
    "description": "Standard invoice documents",
    "schema": {
      "fields": [...]
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### Update Document Type

**Request:**
```http
PUT /v1/document-types/dt-456 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "description": "Updated invoice document description"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "documentTypeId": "dt-456",
    "customerId": "cust-123",
    "name": "Invoice",
    "description": "Updated invoice document description",
    "schema": {
      "fields": [...]
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T11:30:00Z"
  }
}
```

### Delete Document Type

**Request:**
```http
DELETE /v1/document-types/dt-456 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Document type deleted successfully"
}
```

## Error Responses

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
    "message": "Access denied: Document type belongs to another customer"
  }
}
```

### 404 Not Found
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Document type dt-456 not found"
  }
}
```

### 409 Conflict
```json
{
  "error": {
    "code": "DUPLICATE_NAME",
    "message": "Document type with name 'Invoice' already exists"
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to create document type"
  }
}
```

## Security Features

### Tenant Isolation
- Customer ID extracted from JWT token
- All queries filtered by customer ID
- Cross-tenant access blocked with 403 Forbidden

### Input Validation
- Name sanitization (alphanumeric, hyphens, underscores only)
- Schema structure validation
- Duplicate field name prevention
- Required field validation

### IAM Permissions
- Lambda functions have least-privilege access
- DynamoDB permissions scoped to specific tables
- S3 permissions scoped to customer prefixes

## Monitoring & Logging

All Lambda functions log to CloudWatch:
- Request/response details
- Customer ID for tenant tracking
- Error messages with stack traces
- Performance metrics (duration, memory usage)

## Next Steps

### Phase 2 Remaining Tasks
1. Template API endpoints (Task 10.2)
2. Document processing API endpoints (Task 10.3)
3. Frontend integration (Tasks 16-18)
4. Step Functions pipeline (Task 9)
5. Textract/Bedrock integration (Tasks 6-8)
