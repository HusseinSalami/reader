# Deploy Processing Pipeline - Quick Start

## Prerequisites Check

Before deploying, verify:

```bash
# 1. AWS credentials configured
aws sts get-caller-identity

# 2. CDK bootstrapped (one-time setup)
cdk bootstrap

# 3. All tests passing
npm test
```

## Deploy Backend

```bash
cd reader/backend

# Install dependencies (if not already done)
npm install

# Synthesize CloudFormation template
cdk synth

# Deploy to AWS
cdk deploy --require-approval never
```

**Expected deployment time:** 5-10 minutes

## Post-Deployment: Get API URL

```bash
# Get API URL from CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name MultiTenantDocumentPlatformStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

Or check the CDK deploy output - it will show:
```
Outputs:
MultiTenantDocumentPlatformStack.ApiUrl = https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/
```

## Test the Pipeline

### Option 1: Automated Test Script (Recommended)

```bash
# Set API URL (from deploy output)
export API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/"

# Run test script
./test-processing-pipeline.sh
```

This will:
1. Register a test user
2. Create a document type (Invoice)
3. Create a template with extraction rules
4. Upload a test document
5. Monitor processing status
6. Display extracted data

### Option 2: Manual Testing with curl

#### 1. Register User
```bash
curl -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "companyName": "Test Co",
    "firstName": "Test",
    "lastName": "User"
  }'
```

#### 2. Login
```bash
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }' | jq -r '.token')

echo "Token: $TOKEN"
```

#### 3. Create Document Type
```bash
DOCTYPE_ID=$(curl -s -X POST "$API_URL/v1/document-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invoice",
    "description": "Invoice document",
    "schema": {
      "fields": [
        {
          "fieldId": "invoice_number",
          "name": "Invoice Number",
          "dataType": "string",
          "required": true,
          "validationRules": [{"type": "required", "params": {}}]
        }
      ]
    }
  }' | jq -r '.documentTypeId')

echo "Document Type ID: $DOCTYPE_ID"
```

#### 4. Create Template
```bash
TEMPLATE_ID=$(curl -s -X POST "$API_URL/v1/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Invoice Template\",
    \"documentTypeId\": \"$DOCTYPE_ID\",
    \"rules\": [
      {
        \"fieldId\": \"invoice_number\",
        \"method\": \"textract_kv\",
        \"params\": {\"keyPattern\": \"invoice number\"}
      }
    ]
  }" | jq -r '.templateId')

echo "Template ID: $TEMPLATE_ID"
```

#### 5. Upload Document
```bash
# Create test file
echo "Invoice Number: INV-001" > test.txt

# Convert to base64
FILE_CONTENT=$(base64 test.txt | tr -d '\n')

# Upload
DOCUMENT_ID=$(curl -s -X POST "$API_URL/v1/documents/upload-new" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"documentTypeId\": \"$DOCTYPE_ID\",
    \"templateId\": \"$TEMPLATE_ID\",
    \"filename\": \"test.txt\",
    \"fileContent\": \"$FILE_CONTENT\"
  }" | jq -r '.documentId')

echo "Document ID: $DOCUMENT_ID"
```

#### 6. Check Status
```bash
# Wait 30 seconds for processing
sleep 30

# Get document details
curl -s -X GET "$API_URL/v1/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

## Monitor Processing

### Step Functions Console
1. Go to AWS Console → Step Functions
2. Find state machine: `DocumentProcessingPipeline`
3. View recent executions
4. Click execution to see visual workflow

### CloudWatch Logs
```bash
# View logs for each Lambda
aws logs tail /aws/lambda/InvokeTextractFunction --follow
aws logs tail /aws/lambda/CheckTextractStatusFunction --follow
aws logs tail /aws/lambda/ExtractFieldsFunction --follow
aws logs tail /aws/lambda/InvokeBedrockFunction --follow
aws logs tail /aws/lambda/ValidateFieldsFunction --follow
aws logs tail /aws/lambda/StoreResultsFunction --follow
```

## Verify Bedrock Access

If you see Bedrock errors, verify model access:

```bash
# List available models
aws bedrock list-foundation-models --region us-east-1 \
  | jq '.modelSummaries[] | select(.modelId | contains("claude-3-sonnet"))'
```

If no models returned:
1. Go to AWS Console → Bedrock (us-east-1 region)
2. Click "Model access" in left sidebar
3. Click "Manage model access"
4. Enable "Claude 3 Sonnet"
5. Submit request (usually instant approval)

## Troubleshooting

### Deployment Fails
```bash
# Check CDK version
cdk --version  # Should be 2.170.0 or higher

# Check Node version
node --version  # Should be 18.x or 20.x

# Clean and retry
rm -rf cdk.out node_modules
npm install
cdk deploy
```

### Textract Errors
- Verify Textract is available in your region
- Check service quotas: AWS Console → Service Quotas → Textract
- Ensure document is < 10MB and supported format

### Step Functions Timeout
- Default timeout is 15 minutes
- Check CloudWatch logs for specific Lambda errors
- Verify IAM permissions

### No Extracted Data
- Check template rules match document structure
- Verify Textract successfully parsed document
- Check CloudWatch logs for extraction errors

## Success Indicators

✅ CDK deploy completes without errors
✅ All Lambda functions created
✅ Step Functions state machine created
✅ Test document uploads successfully
✅ Document status changes to "processing"
✅ Step Functions execution completes
✅ Document status changes to "completed"
✅ Extracted data appears in document response

## Next Steps

After successful deployment:

1. **Test with real documents** - Upload actual PDFs/images
2. **Monitor costs** - Check Textract and Bedrock usage
3. **Update frontend** - Proceed to Option B
4. **Add monitoring** - Set up CloudWatch alarms
5. **Production hardening** - Add error notifications, retry logic

## Rollback

If you need to rollback:

```bash
# Delete the stack
cdk destroy

# Or rollback to previous version
aws cloudformation rollback-stack \
  --stack-name MultiTenantDocumentPlatformStack
```

## Cost Estimate

For testing (100 documents):
- Textract: ~$0.15 (100 pages × $0.0015)
- Bedrock: ~$0.30 (100 invocations × ~$0.003)
- Lambda: ~$0.01 (minimal execution time)
- Step Functions: ~$0.01 (100 executions)
- DynamoDB: ~$0.01 (on-demand)
- S3: ~$0.01 (storage)

**Total: ~$0.50 for 100 test documents**

## Support

If you encounter issues:
1. Check CloudWatch logs for error messages
2. Review Step Functions execution history
3. Verify IAM permissions
4. Check service quotas
5. Review deployment checklist

---

**Ready to deploy?** Run: `cdk deploy`
