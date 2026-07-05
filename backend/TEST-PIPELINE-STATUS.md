# Processing Pipeline Test Status

## Summary
Successfully fixed test script data types and added cleanup functionality. Pipeline test is partially working but encountering authorization issues with template endpoints.

## Completed
✅ Fixed data type validation - changed "string" to "text" (valid FieldDataType)
✅ Fixed JSON response parsing - added `.data` path for all API responses
✅ Added duplicate handling for document types
✅ Added cleanup step to delete test resources after execution
✅ Document type creation working successfully

## Current Issue
❌ Template creation failing with authorization error:
```
"Message": "User is not authorized to access this resource because no identity-based policy allows the execute-api:Invoke action"
```

## Root Cause Analysis
The authorization error suggests one of:
1. API Gateway authorizer not properly configured for template routes
2. IAM permissions issue with the authorizer Lambda
3. Token format issue (though document-types work fine with same token)

## Test Script Improvements Made
1. **Data Type Fix**: Changed `dataType: "string"` to `dataType: "text"` to match FieldDataType enum
2. **Response Parsing**: Updated all ID extractions to use `.data.{field} // .{field}` pattern
3. **Duplicate Handling**: Added logic to fetch existing document type if creation fails with DUPLICATE_NAME
4. **Cleanup**: Added Step 8 to delete document, template, and document type after test completes

## Next Steps
1. **Debug Authorization**: Check why template endpoints fail authorization while document-type endpoints work
   - Compare API Gateway configuration for both resources
   - Verify authorizer is attached to template routes
   - Check CloudWatch logs for authorizer Lambda

2. **Complete End-to-End Test**: Once authorization fixed, verify:
   - Template creation
   - Document upload
   - Step Functions execution
   - Textract processing
   - Bedrock field extraction
   - Validation
   - Results storage

3. **Frontend Updates** (Option B from deployment plan):
   - Update Upload page to use new `/v1/documents/upload-new` endpoint
   - Add document type and template selection
   - Display extracted data and validation errors
   - Implement approval workflow UI

## Test Data
- Customer ID: `88f3d237-44c6-4585-8c56-3b38d8f5149d`
- Test User: `test-pipeline@example.com`
- Document Type ID: `4cd9acdc-898c-48e8-b300-6c9791bf4844` (created successfully)
- API URL: `https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/`

## Valid Data Types
From `data-models.ts`:
- `text` - for string values
- `number` - for numeric values
- `date` - for date values
- `boolean` - for true/false
- `table` - for tabular data
- `array` - for arrays

## Files Modified
- `reader/backend/test-processing-pipeline.sh` - Fixed data types, response parsing, added cleanup
- `reader/backend/lambdas/layers/shared/nodejs/types.ts` - Reference for valid field types
- `reader/backend/lambdas/layers/shared/nodejs/data-models.ts` - Schema definitions
