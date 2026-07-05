# Deployment Checklist - Processing Pipeline

## Pre-Deployment

- [x] All 207 tests passing
- [x] Dependencies installed (@aws-sdk/client-bedrock-runtime, @aws-sdk/client-sfn)
- [x] CDK stack updated with processing Lambdas
- [x] Step Functions state machine defined
- [x] IAM permissions configured
- [ ] AWS credentials configured locally
- [ ] CDK bootstrapped in target AWS account

## AWS Prerequisites

### Bedrock Access
- [ ] Enable Bedrock in AWS Console (us-east-1 region)
- [ ] Request access to Claude 3 Sonnet model
- [ ] Verify model access: `anthropic.claude-3-sonnet-20240229-v1:0`

### Textract
- [ ] Verify Textract is available in deployment region
- [ ] Check service quotas for concurrent jobs

### IAM Permissions
- [ ] Verify deployment role has permissions for:
  - CloudFormation
  - Lambda
  - Step Functions
  - DynamoDB
  - S3
  - IAM (for role creation)
  - Textract
  - Bedrock

## Deployment Steps

### 1. Build and Test
```bash
cd reader/backend
npm install
npm test
```

Expected: All 207 tests pass

### 2. Synthesize CDK
```bash
cdk synth
```

Expected: CloudFormation template generated without errors

### 3. Deploy Stack
```bash
cdk deploy
```

Expected outputs:
- ProcessingStateMachineArn
- ApiUrl
- DocumentBucketName
- DocumentPlatformTableName

### 4. Verify Resources

#### DynamoDB
```bash
aws dynamodb describe-table --table-name DocumentPlatform
```

#### S3 Bucket
```bash
aws s3 ls | grep document-platform
```

#### Step Functions
```bash
aws stepfunctions describe-state-machine \
  --state-machine-arn <ProcessingStateMachineArn>
```

#### Lambda Functions
```bash
aws lambda list-functions | grep -E "(Textract|Bedrock|Extract|Validate|Store)"
```

## Post-Deployment Testing

### 1. Test Document Upload
```bash
# Get API URL from CDK outputs
API_URL="<your-api-url>"

# Login to get JWT token
TOKEN=$(curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}' \
  | jq -r '.token')

# Upload a test document
curl -X POST "$API_URL/v1/documents/upload-new" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentTypeId": "dt-123",
    "templateId": "tpl-456",
    "filename": "test.pdf",
    "fileContent": "<base64-encoded-pdf>",
    "language": "en"
  }'
```

### 2. Monitor Step Functions Execution
```bash
# List recent executions
aws stepfunctions list-executions \
  --state-machine-arn <ProcessingStateMachineArn> \
  --max-results 10

# Get execution details
aws stepfunctions describe-execution \
  --execution-arn <execution-arn>
```

### 3. Check CloudWatch Logs
```bash
# View Lambda logs
aws logs tail /aws/lambda/InvokeTextractFunction --follow
aws logs tail /aws/lambda/CheckTextractStatusFunction --follow
aws logs tail /aws/lambda/ExtractFieldsFunction --follow
aws logs tail /aws/lambda/InvokeBedrockFunction --follow
aws logs tail /aws/lambda/ValidateFieldsFunction --follow
aws logs tail /aws/lambda/StoreResultsFunction --follow
```

### 4. Verify Document Processing
```bash
# Get document details
curl -X GET "$API_URL/v1/documents/<document-id>" \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
- status: "completed"
- extractedData: { fields: {...} }
- validationErrors: []

## Troubleshooting

### Bedrock Access Denied
```bash
# Check Bedrock model access
aws bedrock list-foundation-models --region us-east-1

# Request model access in AWS Console:
# Bedrock > Model access > Request access
```

### Textract Timeout
- Increase Step Functions timeout in CDK stack
- Check Textract service quotas
- Verify document is < 10MB and supported format

### Lambda Timeout
- Check CloudWatch logs for specific Lambda
- Increase timeout in CDK stack if needed
- Verify DynamoDB and S3 permissions

### State Machine Fails
```bash
# Get execution history
aws stepfunctions get-execution-history \
  --execution-arn <execution-arn> \
  --max-results 100
```

## Rollback Plan

If deployment fails or issues arise:

```bash
# Rollback to previous stack version
cdk deploy --rollback

# Or delete stack completely
cdk destroy
```

## Monitoring Setup

### CloudWatch Alarms
- [ ] Create alarm for Step Functions execution failures
- [ ] Create alarm for Lambda errors
- [ ] Create alarm for Textract job failures
- [ ] Create alarm for Bedrock throttling

### Dashboards
- [ ] Create CloudWatch dashboard for processing metrics
- [ ] Monitor Lambda duration and memory usage
- [ ] Track Textract and Bedrock costs

## Security Checklist

- [ ] Verify S3 bucket encryption enabled
- [ ] Verify DynamoDB encryption at rest
- [ ] Verify Lambda functions use least privilege IAM roles
- [ ] Verify API Gateway has JWT authorization
- [ ] Verify no hardcoded credentials in code
- [ ] Verify CloudWatch logs retention policy set

## Cost Optimization

- [ ] Set DynamoDB to on-demand billing
- [ ] Configure S3 lifecycle policies
- [ ] Set CloudWatch logs retention to 30 days
- [ ] Monitor Bedrock usage and costs
- [ ] Consider Textract batch processing for high volume

## Documentation

- [ ] Update API documentation with new endpoints
- [ ] Document processing pipeline flow
- [ ] Create runbook for common issues
- [ ] Document monitoring and alerting setup

## Sign-Off

- [ ] Development team tested locally
- [ ] QA team verified in staging
- [ ] Security review completed
- [ ] Cost estimate approved
- [ ] Deployment window scheduled
- [ ] Rollback plan reviewed
- [ ] On-call team notified

## Post-Deployment

- [ ] Monitor for 24 hours
- [ ] Review CloudWatch metrics
- [ ] Check error rates
- [ ] Verify cost tracking
- [ ] Update documentation
- [ ] Notify stakeholders of completion

---

## Quick Deploy Command

```bash
cd reader/backend && \
npm install && \
npm test && \
cdk synth && \
cdk deploy --require-approval never
```

## Emergency Contacts

- AWS Support: [Support Case Link]
- On-Call Engineer: [Contact Info]
- Team Lead: [Contact Info]
