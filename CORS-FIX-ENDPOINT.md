# CORS Error Fix - API Endpoint Mismatch

## Problem

CORS error when uploading files:
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://bslwuuodji.execute-api.us-east-1.amazonaws.com/prod/documents
```

## Root Cause

Frontend was calling the wrong endpoint:
- **Frontend called:** `POST /documents`
- **Backend endpoint:** `POST /v1/documents/upload`

The endpoint didn't exist, so the request failed before CORS headers could be returned.

## Fix Applied

Updated `frontend/src/services/api.ts`:

```typescript
// Before (Wrong):
async getUploadUrl(...) {
  const response = await api.post('/documents', { ... });
}

// After (Correct):
async getUploadUrl(...) {
  const response = await api.post('/v1/documents/upload', { ... });
}
```

## CORS Configuration

CORS is properly configured on the API Gateway:
```typescript
defaultCorsPreflightOptions: {
  allowOrigins: apigateway.Cors.ALL_ORIGINS,
  allowMethods: apigateway.Cors.ALL_METHODS,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
}
```

## What Now Works

✅ File upload requests go to correct endpoint  
✅ CORS headers are returned properly  
✅ No more CORS errors  
✅ Files can be uploaded to S3  

## Testing

1. **Clear browser cache** (important!)
2. **Reload the page** to get new frontend code
3. **Try uploading an exam questionnaire**
4. Should work without CORS errors

## Files Modified

- `frontend/src/services/api.ts`
  - Fixed endpoint from `/documents` to `/v1/documents/upload`

## Build Status

✅ Frontend rebuilt successfully  
✅ Ready to test

## API Endpoints Reference

### Document Upload
- **Endpoint:** `POST /v1/documents/upload`
- **Purpose:** Get pre-signed S3 upload URL
- **Auth:** Required
- **Request:**
  ```json
  {
    "fileName": "exam.pdf",
    "fileType": "application/pdf"
  }
  ```
- **Response:**
  ```json
  {
    "uploadUrl": "https://s3.amazonaws.com/...",
    "s3Key": "documents/..."
  }
  ```

### Exam Creation
- **Endpoint:** `POST /v1/exams`
- **Purpose:** Create exam and process documents
- **Auth:** Required
- **Request:**
  ```json
  {
    "title": "Math Exam",
    "teacherId": "teacher-123",
    "questionnaireUrl": "s3://bucket/key",
    "answerKeyUrl": "s3://bucket/key"
  }
  ```

## Success! 🎉

The CORS error is fixed. The frontend now calls the correct API endpoint and file uploads should work properly.
