# Exam Creation Fix - Complete

## Issue
When uploading answer key, the exam creation was failing with HTTP 500 error:
```
{ code: "INTERNAL_ERROR", message: "Failed to create exam" }
```

## Root Causes Identified

### 1. Missing customerId Parameter
**File**: `backend/lambdas/layers/shared/nodejs/exam-management-service.ts`

The `createExam` method was calling DocumentProcessor methods without passing the required `customerId` parameter:

```typescript
// BEFORE (WRONG):
const questionnaireResult = await documentProcessor.extractQuestionsFromQuestionnaire(
  examData.questionnaireUrl
);

const answerKeyResult = await documentProcessor.extractAnswerKeyMappings(
  examData.answerKeyUrl
);

// AFTER (FIXED):
const questionnaireResult = await documentProcessor.extractQuestionsFromQuestionnaire(
  examData.questionnaireUrl,
  customerId  // ← Added missing parameter
);

const answerKeyResult = await documentProcessor.extractAnswerKeyMappings(
  examData.answerKeyUrl,
  customerId  // ← Added missing parameter
);
```

### 2. S3 URL Format Issue
**Files**: 
- `frontend/.env`
- `frontend/src/pages/CreateExamWizard.tsx`

The frontend was sending S3 keys (like `documents/abc123.pdf`) instead of full S3 URLs (like `s3://bucket/key`). The backend's `DocumentProcessor.parseS3Url()` expects URLs in the format `s3://bucket/key`.

**Frontend Changes**:

1. Added S3 bucket name to environment variables:
```env
VITE_S3_BUCKET=document-platform-380018306486-us-east-1
```

2. Updated `handleQuestionnaireUpload` to construct full S3 URL:
```typescript
const s3Bucket = import.meta.env.VITE_S3_BUCKET || 'document-platform-380018306486-us-east-1';
const s3Url = `s3://${s3Bucket}/${uploadData.s3Key}`;
setQuestionnaireS3Key(s3Url);  // Store full URL instead of just key
```

3. Updated `handleAnswerKeyUpload` to construct full S3 URL:
```typescript
const s3Bucket = import.meta.env.VITE_S3_BUCKET || 'document-platform-380018306486-us-east-1';
const answerKeyS3Url = `s3://${s3Bucket}/${uploadData.s3Key}`;
```

### 3. Duplicate Title Input Removed
**File**: `frontend/src/pages/CreateExamWizard.tsx`

Removed duplicate title input from Step 5 since title is now captured in Step 1. Step 5 now displays the title as read-only in a summary view.

## Files Modified

### Backend
- `backend/lambdas/layers/shared/nodejs/exam-management-service.ts` - Added customerId parameter to DocumentProcessor calls

### Frontend
- `frontend/.env` - Added VITE_S3_BUCKET environment variable
- `frontend/src/pages/CreateExamWizard.tsx` - Fixed S3 URL construction and removed duplicate title input

## Deployment Status

### Backend
**Status**: ⚠️ NEEDS DEPLOYMENT
**Reason**: AWS credentials expired

The backend code has been fixed but needs to be deployed:
```bash
cd backend
bash deploy-multi-tenant.sh
```

### Frontend
**Status**: ✅ BUILT
The frontend has been rebuilt with the fixes:
```bash
cd frontend
npm run build  # Already completed
```

## Testing Instructions

Once backend is deployed:

1. Navigate to the Create Exam wizard
2. Enter exam title in Step 1
3. Upload questionnaire document (PDF/DOCX/Image)
4. Upload answer key document
5. Verify that:
   - No validation errors occur
   - Questions are extracted from the questionnaire
   - Answer mappings are extracted from the answer key
   - Exam is created successfully

## Expected Behavior

After the fix:
1. Frontend constructs proper S3 URLs: `s3://document-platform-380018306486-us-east-1/customer-id/documents/...`
2. Backend receives S3 URLs in correct format
3. DocumentProcessor successfully parses S3 URLs and extracts bucket/key
4. Textract processes documents with correct S3 references
5. Exam is created with extracted questions and answer mappings

## Technical Details

### S3 URL Format
The DocumentProcessor expects S3 URLs in this format:
```
s3://bucket-name/path/to/file.pdf
```

The `parseS3Url` method extracts:
- Bucket: `bucket-name`
- Key: `path/to/file.pdf`

### DocumentProcessor Method Signatures
```typescript
async extractQuestionsFromQuestionnaire(
  documentUrl: string,  // s3://bucket/key format
  customerId: string    // Required for multi-tenant isolation
): Promise<ExtractedQuestionnaire>

async extractAnswerKeyMappings(
  documentUrl: string,  // s3://bucket/key format
  customerId: string    // Required for multi-tenant isolation
): Promise<AnswerKeyMapping[]>
```

## Related Issues Fixed

- Task 6: Missing exam title validation error
- S3 URL format mismatch between frontend and backend
- Missing customerId parameter causing TypeScript compilation issues
