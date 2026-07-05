# End-to-End Dissertation Exam Test Guide

This guide explains how to run the complete end-to-end test that simulates the exact workflow a user would follow in the UI.

## What This Test Does

The E2E test (`test-dissertation-exam-e2e.ts`) performs the complete workflow:

1. ✅ **Upload Questionnaire** - Uploads the exam questions document to S3
2. ✅ **Upload Answer Key** - Uploads the expected answers document to S3
3. ✅ **Create Exam** - Calls `POST /v1/exams` API to create the exam
4. ✅ **Upload Submissions** - Calls `POST /v1/exams/{examId}/submissions` for each student
5. ✅ **Monitor Grading** - Polls `GET /v1/submissions/{id}` until grading completes
6. ✅ **Retrieve Results** - Gets final scores and displays comprehensive report

This is **exactly** how the UI will work, ensuring everything functions correctly.

## Prerequisites

### 1. Deploy the Backend Stack

```bash
cd backend
npm install
npm run deploy
```

Wait for deployment to complete. Note the API Gateway URL from the outputs.

### 2. Get the API URL

Option A - Automatic:
```bash
./get-api-url.sh
```

Option B - Manual:
```bash
# From CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name MultiTenantDocumentPlatformStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

Option C - From AWS Console:
1. Go to CloudFormation
2. Find your stack
3. Click "Outputs" tab
4. Copy the ApiUrl value

### 3. Set Environment Variables

```bash
export API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
export AWS_REGION=us-east-1
export BUCKET_NAME=your-bucket-name
```

Or add to `.env` file:
```bash
API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
AWS_REGION=us-east-1
BUCKET_NAME=document-platform-380018306486-us-east-1
```

## Running the Test

### Quick Run

```bash
cd backend
npx ts-node test-dissertation-exam-e2e.ts
```

### With Environment Variables

```bash
cd backend
API_URL=https://your-api.execute-api.us-east-1.amazonaws.com/prod \
BUCKET_NAME=your-bucket-name \
npx ts-node test-dissertation-exam-e2e.ts
```

## Expected Output

```
🎓 End-to-End Dissertation Exam Test
================================================================================
API URL: https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
Region: us-east-1
Bucket: document-platform-380018306486-us-east-1
Customer: test-customer-dissertation-e2e
Examples: /path/to/examples/dissertation-exam

📄 STEP 1: Uploading Questionnaire
--------------------------------------------------------------------------------
✓ Uploaded questionnaire to: s3://bucket/path/questionnaire.md

📋 STEP 2: Uploading Answer Key
--------------------------------------------------------------------------------
✓ Uploaded answer key to: s3://bucket/path/answer-key.md

🎯 STEP 3: Creating Exam via API
--------------------------------------------------------------------------------
Sending POST /v1/exams...
✓ Exam created successfully!
  Exam ID: exam-12345
  Title: Literature Analysis Exam - Grade 11 (E2E Test)
  Questions: 5
  Status: ACTIVE

👥 STEP 4: Uploading Student Submissions via API
--------------------------------------------------------------------------------
Uploading submission for Ahmed Hassan...
  Sending POST /v1/exams/exam-12345/submissions...
  ✓ Submission created: sub-12345
    Status: PROCESSING

Uploading submission for Fatima Ali...
  ✓ Submission created: sub-12346
    Status: PROCESSING

Uploading submission for Omar Ibrahim...
  ✓ Submission created: sub-12347
    Status: PROCESSING

✓ Uploaded 3 submissions

⏳ STEP 5: Waiting for AI Grading to Complete
--------------------------------------------------------------------------------
Checking status of sub-12345...
  Status: PROCESSING

Waiting 5s before next check...

Checking status of sub-12345...
  Status: GRADED

✓ All submissions graded!

📊 STEP 6: Retrieving Grading Results
--------------------------------------------------------------------------------
Ahmed Hassan (2026-1145):
  Status: GRADED
  Total Score: 45/50
  Questions Graded: 5
    Q1: 9/10 pts (90% confidence)
    Q2: 9/10 pts (90% confidence)
    Q3: 10/10 pts (100% confidence)
    Q4: 9/10 pts (90% confidence)
    Q5: 8/10 pts (90% confidence)
  Final: 45/50 (90.0%)

[Similar output for other students...]

================================================================================
📊 FINAL E2E TEST REPORT
================================================================================

Exam Information:
  Exam ID: exam-12345
  Title: Literature Analysis Exam - Grade 11 (E2E Test)
  Status: ACTIVE

Student Results (sorted by score):
🥇 1. Fatima Ali           49/50 (98%) - Grade: A
🥈 2. Omar Ibrahim         48/50 (96%) - Grade: A
🥉 3. Ahmed Hassan         45/50 (90%) - Grade: A

Statistics:
  Average Score: 94.7%
  Highest Score: 98% (Fatima Ali)
  Lowest Score: 90% (Ahmed Hassan)
  Students Graded: 3

================================================================================
✅ END-TO-END TEST COMPLETED
================================================================================

Key Achievements:
  ✓ Uploaded questionnaire and answer key to S3
  ✓ Created exam via POST /v1/exams API
  ✓ Uploaded 3 student submissions via API
  ✓ Monitored grading status via GET /v1/submissions/{id}
  ✓ Retrieved final results

The complete workflow works end-to-end through the API! 🎉
This is exactly how the UI will interact with the backend.
```

## What Gets Tested

### API Endpoints Used

1. **POST /v1/exams**
   - Creates exam from questionnaire and answer key
   - Tests document processing and extraction
   - Validates exam creation

2. **POST /v1/exams/{examId}/submissions**
   - Uploads student submission
   - Triggers async grading process
   - Returns submission ID

3. **GET /v1/submissions/{submissionId}**
   - Retrieves submission status
   - Gets grading results
   - Shows confidence scores

### Services Tested

- ✅ S3 document upload
- ✅ Document processor (question extraction)
- ✅ Answer key extraction
- ✅ Exam management service
- ✅ Submission management service
- ✅ AI grading engine (Bedrock Claude)
- ✅ Handwriting recognizer (Textract)
- ✅ DynamoDB storage
- ✅ API Gateway routing
- ✅ Lambda function execution
- ✅ Async processing queue

## Troubleshooting

### Error: API_URL not configured

```bash
export API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
```

### Error: Cannot find module 'axios'

```bash
cd backend
npm install
```

### Error: Access Denied to S3

Make sure your AWS credentials have permissions to:
- Upload to S3 bucket
- Invoke API Gateway
- Access DynamoDB (if testing locally)

### Error: API returns 401 Unauthorized

The test uses a mock JWT token. For production:
1. Get real token from Cognito
2. Update `MOCK_TOKEN` in the script
3. Or disable authentication for testing

### Grading Takes Too Long

The test waits up to 5 minutes for grading. If it times out:
1. Check CloudWatch logs for Lambda errors
2. Verify Bedrock is enabled in your region
3. Check SQS queue for stuck messages
4. Increase `maxWaitTime` in the script

### No Results Returned

If grading completes but no results show:
1. Check submission status in DynamoDB
2. Verify grading decisions are stored
3. Check Lambda logs for errors
4. Ensure AI grading engine is working

## Differences from Unit Test

| Aspect | Unit Test | E2E Test |
|--------|-----------|----------|
| Services | Direct service calls | API endpoints |
| Authentication | None | JWT token |
| S3 Upload | Direct | Via API |
| Grading | Synchronous | Asynchronous |
| Monitoring | Immediate | Polling |
| Realistic | Partial | Complete |

## Next Steps

After successful E2E test:

1. **Test in UI**: The exact same workflow will work in the frontend
2. **Deploy Frontend**: Build and deploy the React app
3. **Manual Testing**: Upload real documents through UI
4. **Load Testing**: Test with multiple concurrent users
5. **Production**: Deploy to production environment

## Files Used

```
backend/examples/dissertation-exam/
├── dissertation-questionnaire.md      # Exam questions
├── dissertation-answer-key.md         # Expected answers
├── student-answer-sample-1.md         # Ahmed Hassan
├── student-answer-sample-2.md         # Fatima Ali
└── student-answer-sample-3.md         # Omar Ibrahim
```

## API Flow Diagram

```
User/UI
  │
  ├─► POST /v1/exams
  │     ├─► Upload questionnaire to S3
  │     ├─► Extract questions (Textract)
  │     ├─► Upload answer key to S3
  │     ├─► Extract expected answers
  │     └─► Store exam in DynamoDB
  │
  ├─► POST /v1/exams/{examId}/submissions
  │     ├─► Upload student answer to S3
  │     ├─► Create submission record
  │     ├─► Queue for processing (SQS)
  │     └─► Return submission ID
  │
  ├─► [Async Processing]
  │     ├─► Extract student answers (Textract)
  │     ├─► Grade with AI (Bedrock Claude)
  │     ├─► Calculate scores
  │     └─► Update submission status
  │
  └─► GET /v1/submissions/{submissionId}
        └─► Return grading results
```

## Success Criteria

✅ All API calls return 200 OK
✅ Exam is created with correct structure
✅ All submissions are uploaded successfully
✅ Grading completes within timeout
✅ Results match expected scores (±10%)
✅ Confidence scores are reasonable (>80%)
✅ No errors in CloudWatch logs

## Conclusion

This E2E test validates that the entire system works correctly through the API, exactly as the UI will use it. If this test passes, you can be confident that uploading documents through the UI will work properly.
