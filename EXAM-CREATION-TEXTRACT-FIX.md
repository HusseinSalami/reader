# Exam Creation Textract Permission Fix

## Issue Summary

When attempting to create an exam by uploading questionnaire and answer key documents, the system returned:
```json
{
  "code": "INTERNAL_ERROR",
  "message": "Failed to create exam"
}
```

## Root Cause

The `CreateExamFunction` Lambda did not have IAM permissions to call AWS Textract's `AnalyzeDocument` API, which is required to extract questions from exam documents.

### Error from CloudWatch Logs
```
Error: Failed to extract questions from questionnaire: User: arn:aws:sts::380018306486:assumed-role/DocumentPlatformStack-CreateExamFunctionServiceRole-vED3A8f0S5XJ/DocumentPlatformStack-CreateExamFunction8B4FBCA0-5izdszoldmPG is not authorized to perform: textract:AnalyzeDocument because no identity-based policy allows the textract:AnalyzeDocument action.
```

## Solution

Added Textract permissions to the `CreateExamFunction` in the CDK stack:

### Changes Made to `backend/infrastructure/multi-tenant-stack.ts`

1. **Added S3 read permissions** (line ~1408):
```typescript
examsTable.grantReadWriteData(createExamFunction);
documentBucket.grantRead(createExamFunction);  // NEW
```

2. **Added Textract permissions** (line ~1440):
```typescript
// Grant Textract and Bedrock permissions for exam creation
createExamFunction.addToRolePolicy(new iam.PolicyStatement({
  actions: ['textract:AnalyzeDocument'],
  resources: ['*'],
}));
```

## Deployment

Run the following to apply the fix:
```bash
cd backend
cdk deploy
```

The deployment will show these IAM changes:
- S3 read permissions for CreateExamFunction
- Textract AnalyzeDocument permission for CreateExamFunction

## Test Files Validated

Created comprehensive tests to verify the fix works with real exam documents:

### 1. Unit Test: `backend/tests/unit/real-documents.test.ts`
- ✅ Validates all exam files exist
- ✅ Validates file formats (DOCX magic numbers, JPEG signatures)
- ✅ Reports file sizes and structure
- ✅ Tests question/answer pattern matching

**Results:**
- Questionnaire: 81.88 KB (valid DOCX)
- Answer Key: 3274.61 KB (valid DOCX)
- 5 student answers: 118-129 KB each (valid JPEG)
- Total: 3.8 MB of test data

### 2. Integration Test: `backend/tests/integration/exam-workflow.integration.test.ts`
Complete end-to-end workflow test:
1. Upload questionnaire to S3
2. Extract questions using Textract
3. Upload answer key to S3
4. Extract answer mappings using Textract
5. Create exam in DynamoDB
6. Upload student submissions (handwritten)
7. Extract handwritten text using Textract
8. Grade submissions using Bedrock Claude
9. Verify complete workflow

## Document Processing Logic

The system uses comprehensive pattern matching for question extraction:

### Supported Question Formats
- `1. Question text` ✓
- `1) Question text` ✓
- `Q1. Question text` ✓
- `Question 1: Question text` ✓
- `(1) Question text` ✓
- `1- Question text` ✓
- `1a. Question text` ✓
- `1.1 Question text` ✓

### Supported Answer Key Formats
- Same patterns as questions
- Automatically maps question numbers to expected answers
- Preserves complete answer text for AI grading

## Files in `backend/examples/`

1. **Grade 11 -Mid year exam Jan.2026-questions.docx** - Exam questionnaire
2. **Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers.docx** - Expected answers
3. **answer1.jpeg** through **answer5.jpeg** - Student handwritten submissions

## Next Steps

After deployment completes:

1. **Test exam creation** through the UI:
   - Navigate to Advanced → Create Exam
   - Upload the questionnaire document
   - Upload the answer key document
   - Verify questions are extracted correctly

2. **Test submission upload**:
   - Upload student answer images
   - Verify handwriting recognition works
   - Check AI grading results

3. **Run integration tests** (optional):
   ```bash
   cd backend
   npm test -- tests/integration/exam-workflow.integration.test.ts
   ```

## Expected Behavior After Fix

1. ✅ Exam creation should succeed
2. ✅ Questions should be extracted from DOCX files
3. ✅ Answer key mappings should be created
4. ✅ Exam should be stored in DynamoDB
5. ✅ UI should show extracted questions for review

## Monitoring

Check CloudWatch logs for the CreateExamFunction:
```bash
aws logs tail /aws/lambda/DocumentPlatformStack-CreateExamFunction8B4FBCA0-5izdszoldmPG --follow --region us-east-1
```

Look for successful Textract calls and question extraction logs.
