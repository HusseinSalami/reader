# Error Handling Implementation - COMPLETE ✅

## Overview

Added comprehensive error handling to the document processing pipeline to ensure documents are properly marked as 'failed' when any step in the workflow encounters an error.

## What Was Implemented

### 1. Mark Failed Lambda Function ✅

**File**: `backend/lambdas/processing/mark-failed.ts`

**Purpose**: Updates document status to 'failed' in DynamoDB when processing fails

**Features**:
- Extracts error message from various error formats
- Updates document status to 'failed'
- Records error message for debugging
- Sets processedAt timestamp
- Graceful error handling (doesn't throw if update fails)

**DynamoDB Update**:
```typescript
{
  status: 'failed',
  errorMessage: 'Extracted error message',
  processedAt: '2026-01-30T...'
}
```

### 2. Step Functions Error Handling ✅

**File**: `backend/infrastructure/multi-tenant-stack.ts`

**Error Handling Strategy**:
- Added `.addCatch()` to all Lambda invocation tasks
- Errors are caught and routed to `markFailedTask`
- Error details stored in `$.error` path
- After marking as failed, state machine transitions to `processingFailed` state

**Tasks with Error Handling**:
1. ✅ PreProcessTask
2. ✅ InvokeTextractTask
3. ✅ CheckTextractStatusTask
4. ✅ ExtractFieldsTask
5. ✅ ValidateFieldsTask
6. ✅ StoreResultsTask

**Special Cases**:
- **Bedrock failures**: Caught but processing continues (non-critical)
- **Textract failures**: Detected via status check, routes to markFailedTask
- **All other failures**: Immediately caught and routed to markFailedTask

### 3. Workflow Flow

**Success Path**:
```
PreProcess → Textract → Wait → Check Status → Extract → Bedrock → Validate → Store → Complete ✅
```

**Failure Path**:
```
Any Step → [Error] → Mark Failed → Processing Failed ❌
```

**Textract Failure Path**:
```
Textract → Wait → Check Status → [FAILED] → Mark Failed → Processing Failed ❌
```

## Error Handling Details

### Catch Configuration

Each task has error handling configured:
```typescript
taskName.addCatch(markFailedTask, {
  resultPath: '$.error'
});
```

This means:
- Any error in the task is caught
- Error details are stored in `$.error`
- Execution continues to `markFailedTask`
- Document is marked as failed in DynamoDB
- State machine ends in `processingFailed` state

### Error Information Captured

The `markFailedTask` receives:
- `documentId`: Document being processed
- `customerId`: Customer who owns the document
- `error`: Full error object from the failed step
- `errorMessage`: Extracted error message

### Document Status Updates

**Before Error Handling**:
- Document stuck in 'processing' status forever
- No indication of what went wrong
- Users couldn't tell if processing failed

**After Error Handling**:
- Document status updated to 'failed'
- Error message stored for debugging
- processedAt timestamp recorded
- Users can see failed documents in UI

## Testing

### Test Scenarios

1. **Pre-processing Failure**:
   - Upload invalid file format
   - Expected: Document marked as 'failed'

2. **Textract Failure**:
   - Upload corrupted PDF
   - Expected: Document marked as 'failed' after status check

3. **Field Extraction Failure**:
   - Missing template or document type
   - Expected: Document marked as 'failed'

4. **Bedrock Failure**:
   - Bedrock service unavailable
   - Expected: Processing continues without AI enhancement

5. **Validation Failure**:
   - Invalid validation rules
   - Expected: Document marked as 'failed'

6. **Storage Failure**:
   - DynamoDB write error
   - Expected: Document marked as 'failed'

### How to Test

1. **Upload a document**:
   ```bash
   # Via frontend or API
   POST /v1/documents/upload-new
   ```

2. **Simulate failure**:
   - Remove required template
   - Upload invalid file
   - Disable Textract temporarily

3. **Check document status**:
   ```bash
   GET /v1/documents/{documentId}
   ```

4. **Verify status**:
   ```json
   {
     "status": "failed",
     "errorMessage": "Specific error message",
     "processedAt": "2026-01-30T..."
   }
   ```

5. **Check Step Functions**:
   - Go to AWS Console → Step Functions
   - Find execution for the document
   - Verify it shows "Failed" status
   - Check execution history for error details

## Frontend Integration

The frontend already handles failed documents:

**Documents List** (`frontend/src/pages/Documents.tsx`):
- Shows 'failed' status with red badge
- Can filter by status including 'failed'

**Document Detail** (`frontend/src/pages/DocumentDetail.tsx`):
- Displays error message if present
- Shows 'failed' status prominently
- No auto-refresh for failed documents

**Status Colors**:
```typescript
const statusColors = {
  pending: '#ff9800',
  processing: '#2196f3',
  completed: '#4caf50',
  failed: '#f44336',  // Red
  needs_review: '#ff9800'
};
```

## Monitoring & Debugging

### CloudWatch Logs

**Mark Failed Function**:
```
/aws/lambda/DocumentPlatformStack-MarkFailedFunction
```

**Log Messages**:
- "Marking document as failed: {documentId}"
- "Document marked as failed successfully"
- Error details if marking fails

### Step Functions Console

1. Go to AWS Console → Step Functions
2. Select "DocumentProcessingPipeline"
3. View executions
4. Failed executions show:
   - Which step failed
   - Error message
   - Input/output at each step
   - Execution timeline

### DynamoDB

Query failed documents:
```bash
aws dynamodb query \
  --table-name DocumentPlatform \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --filter-expression "#status = :status" \
  --expression-attribute-names '{"#status": "status"}' \
  --expression-attribute-values '{
    ":pk": {"S": "CUSTOMER#cust-123"},
    ":sk": {"S": "DOCUMENT#"},
    ":status": {"S": "failed"}
  }'
```

## Benefits

1. **User Visibility**: Users can see which documents failed
2. **Debugging**: Error messages help identify issues
3. **No Stuck Documents**: Documents don't stay in 'processing' forever
4. **Retry Capability**: Users can retry failed documents
5. **Monitoring**: Easy to track failure rates
6. **Alerting**: Can set up alarms on failed documents

## Future Enhancements

### Phase 1 (Optional)
- [ ] Retry mechanism for transient failures
- [ ] Detailed error categorization (Textract, Bedrock, Validation, etc.)
- [ ] Email notifications for failed documents
- [ ] Automatic retry for specific error types

### Phase 2 (Advanced)
- [ ] Dead letter queue for failed documents
- [ ] Manual reprocessing from UI
- [ ] Error analytics dashboard
- [ ] Failure rate alerts
- [ ] Automatic escalation for repeated failures

## Files Changed

### New Files
- ✅ `backend/lambdas/processing/mark-failed.ts` - Mark failed Lambda function

### Modified Files
- ✅ `backend/infrastructure/multi-tenant-stack.ts` - Added error handling to state machine

## Deployment

Deployed successfully on: January 30, 2026

**Changes**:
- New Lambda function: MarkFailedFunction
- Updated Step Functions state machine
- Added error handling to all processing steps

## Status

✅ **PRODUCTION READY**

All processing steps now have comprehensive error handling. Documents will be properly marked as 'failed' when any step encounters an error.

---

## Quick Reference

**Check failed documents**:
```bash
# Via API
GET /v1/documents?status=failed

# Via DynamoDB
aws dynamodb query --table-name DocumentPlatform \
  --index-name GSI2 \
  --key-condition-expression "GSI2PK = :pk AND begins_with(GSI2SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "CUSTOMER#cust-123#STATUS#failed"},
    ":sk": {"S": "DOCUMENT#"}
  }'
```

**View Step Functions execution**:
```bash
aws stepfunctions describe-execution \
  --execution-arn "arn:aws:states:us-east-1:123456789:execution:DocumentProcessingPipeline:..."
```

**Check error logs**:
```bash
aws logs tail /aws/lambda/DocumentPlatformStack-MarkFailedFunction --follow
```
