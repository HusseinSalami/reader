# Batch Submission Handler

This module implements batch submission upload functionality for the AI-Powered Exam Grading System.

## Overview

The batch submission handler allows teachers to upload multiple student submissions at once, queuing each for asynchronous processing via SQS. This enables efficient grading of entire classes without blocking the API.

## Components

### 1. batch-upload.ts

Lambda function that accepts batch submission uploads via API Gateway.

**Endpoint**: `POST /exams/{examId}/submissions/batch`

**Request Body**:
```json
{
  "examId": "exam-123",
  "submissions": [
    {
      "studentId": "student-1",
      "studentName": "Alice Smith",
      "documentUrl": "s3://bucket/alice.pdf"
    },
    {
      "studentId": "student-2",
      "studentName": "Bob Jones",
      "documentUrl": "s3://bucket/bob.pdf"
    }
  ]
}
```

**Response** (202 Accepted):
```json
{
  "message": "Batch upload accepted. 2 submissions queued for processing.",
  "batchId": "batch-uuid",
  "status": {
    "batchId": "batch-uuid",
    "examId": "exam-123",
    "customerId": "customer-123",
    "totalSubmissions": 2,
    "processedCount": 0,
    "successCount": 0,
    "failedCount": 0,
    "status": "QUEUED",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "submissions": [
      {
        "submissionId": "sub-1",
        "studentId": "student-1",
        "studentName": "Alice Smith",
        "status": "QUEUED"
      },
      {
        "submissionId": "sub-2",
        "studentId": "student-2",
        "studentName": "Bob Jones",
        "status": "QUEUED"
      }
    ]
  },
  "queuedCount": 2,
  "failedCount": 0
}
```

**Features**:
- Validates all submission items before processing
- Creates batch tracking record in DynamoDB
- Sends each submission to SQS queue for async processing
- Handles partial failures gracefully
- Returns batch ID for status tracking

### 2. get-batch-status.ts

Lambda function that retrieves the current status of a batch processing operation.

**Endpoint**: `GET /batches/{batchId}`

**Response** (200 OK):
```json
{
  "batchId": "batch-uuid",
  "examId": "exam-123",
  "customerId": "customer-123",
  "totalSubmissions": 2,
  "processedCount": 1,
  "successCount": 1,
  "failedCount": 0,
  "status": "PROCESSING",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:01:00Z",
  "submissions": [
    {
      "submissionId": "sub-1",
      "studentId": "student-1",
      "studentName": "Alice Smith",
      "status": "COMPLETED",
      "processedAt": "2024-01-01T00:01:00Z"
    },
    {
      "submissionId": "sub-2",
      "studentId": "student-2",
      "studentName": "Bob Jones",
      "status": "PROCESSING"
    }
  ]
}
```

### 3. BatchProcessingService

Service class for managing batch processing status updates.

**Methods**:

- `updateSubmissionStatus(batchId, customerId, submissionId, status, error?)`: Updates the status of a single submission within a batch and recalculates batch-level counters
- `getBatchStatus(batchId, customerId)`: Retrieves the current status of a batch
- `emitProgressEvent(batchId, submissionProgress)`: Emits progress events for real-time updates

**Batch Status Transitions**:
- `QUEUED`: Initial state, no submissions processed yet
- `PROCESSING`: At least one submission is being processed
- `COMPLETED`: All submissions processed successfully (or with some failures)
- `FAILED`: All submissions failed

## Data Models

### BatchProcessingRecord (DynamoDB)

```typescript
{
  PK: "CUSTOMER#{customerId}",
  SK: "BATCH#{batchId}",
  batchId: string,
  examId: string,
  customerId: string,
  totalSubmissions: number,
  processedCount: number,
  successCount: number,
  failedCount: number,
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
  createdAt: string,
  updatedAt: string,
  submissions: BatchSubmissionProgress[],
  GSI1PK: "EXAM#{examId}",
  GSI1SK: "BATCH#{createdAt}"
}
```

### SQSSubmissionMessage

```typescript
{
  submissionId: string,
  batchId: string,
  examId: string,
  customerId: string,
  studentId: string,
  studentName: string,
  documentUrl: string
}
```

## Architecture

```
┌─────────────┐
│   Teacher   │
└──────┬──────┘
       │ POST /submissions/batch
       ▼
┌─────────────────────┐
│  batch-upload.ts    │
│  (API Gateway)      │
└──────┬──────────────┘
       │
       ├─► DynamoDB (Batch Record)
       │
       └─► SQS Queue (N messages)
              │
              ▼
       ┌──────────────────┐
       │  SQS Consumer    │
       │  (Task 14.2)     │
       └──────┬───────────┘
              │
              ├─► Process Submission
              │
              └─► BatchProcessingService
                     │
                     └─► Update Status
```

## Error Handling

### Validation Errors (400)
- Missing examId
- Empty submissions array
- Missing studentId, studentName, or documentUrl

### Authorization Errors (401)
- Missing customer ID in request context

### Queue Failures
- Individual SQS send failures are tracked
- Failed submissions marked with error status
- Batch continues processing remaining submissions

### DynamoDB Errors (500)
- Logged with full context
- Returns error to client
- No partial state saved

## Testing

Run tests:
```bash
npm test -- batch-upload.test.ts --run
npm test -- batch-processing-service.test.ts --run
```

**Test Coverage**:
- Request validation (7 tests)
- Successful batch upload (3 tests)
- Partial failures (1 test)
- Error handling (1 test)
- Batch processing service (9 tests)

## Requirements Satisfied

- **Requirement 8.1**: Accept batch uploads of multiple submissions ✓
- **Requirement 8.4**: Display progress indicators for each submission ✓

## Environment Variables

- `EXAMS_TABLE_NAME`: DynamoDB table name for storing batch records
- `GRADING_QUEUE_URL`: SQS queue URL for submission processing

## Multi-Tenant Isolation

All operations enforce multi-tenant isolation:
- Customer ID extracted from API Gateway authorizer
- All DynamoDB records include customer ID
- Batch status queries filtered by customer ID
- SQS messages include customer ID for downstream processing

## Future Enhancements

1. **Real-time Updates**: Integrate with WebSocket API or EventBridge for live progress updates
2. **Batch Cancellation**: Allow teachers to cancel in-progress batches
3. **Retry Failed Submissions**: Provide UI to retry failed submissions
4. **Batch Analytics**: Track average processing time, success rates per exam
