# Document Reader - Complete Deployment Guide

This guide walks you through deploying the complete Document Reader service on AWS.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured:
   ```bash
   aws configure
   ```
3. **Node.js 18+** and npm installed
4. **AWS CDK** installed globally:
   ```bash
   npm install -g aws-cdk
   ```

## Step 1: Deploy Backend Infrastructure

### 1.1 Install Dependencies

```bash
cd reader/backend
npm install
```

### 1.2 Bootstrap CDK (First Time Only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace `ACCOUNT-ID` with your AWS account ID and `REGION` with your preferred region (e.g., us-east-1).

### 1.3 Deploy the Stack

```bash
npm run deploy
```

This will create:
- S3 bucket for document storage
- DynamoDB table for metadata
- Lambda functions for processing
- API Gateway for REST API
- IAM roles and policies

### 1.4 Note the Outputs

After deployment, you'll see outputs like:
```
DocumentReaderStack.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod/
DocumentReaderStack.BucketName = document-reader-123456789-us-east-1
DocumentReaderStack.TableName = DocumentReader-Documents
```

**Save the ApiUrl** - you'll need it for the frontend.

## Step 2: Deploy Frontend

### 2.1 Install Dependencies

```bash
cd reader/frontend
npm install
```

### 2.2 Configure API URL

Update `src/config.ts` with your API URL from Step 1.4:

```typescript
export const API_URL = 'https://abc123.execute-api.us-east-1.amazonaws.com/prod';
```

Or set environment variable:
```bash
export VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/prod
```

### 2.3 Choose Deployment Method

#### Option A: AWS Amplify (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to AWS Amplify Console
3. Click "New app" → "Host web app"
4. Connect your repository
5. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Base directory: `reader/frontend`
6. Add environment variable:
   - Key: `VITE_API_URL`
   - Value: Your API URL from Step 1.4
7. Click "Save and deploy"

#### Option B: S3 + CloudFront

```bash
# Build the app
npm run build

# Create S3 bucket (use unique name)
aws s3 mb s3://my-document-reader-frontend

# Enable static website hosting
aws s3 website s3://my-document-reader-frontend \
  --index-document index.html \
  --error-document index.html

# Upload files
aws s3 sync dist/ s3://my-document-reader-frontend --acl public-read

# Make bucket public
aws s3api put-bucket-policy --bucket my-document-reader-frontend --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-document-reader-frontend/*"
  }]
}'

# Get website URL
echo "http://my-document-reader-frontend.s3-website-us-east-1.amazonaws.com"
```

For HTTPS, create a CloudFront distribution pointing to the S3 bucket.

#### Option C: Local Development

```bash
npm run dev
```

Access at http://localhost:3000

## Step 3: Test the Application

### 3.1 Upload a Document

1. Navigate to the Upload page
2. Drag and drop a PDF or image file
3. Click "Upload Document"
4. Wait for confirmation

### 3.2 View Processing Status

1. Go to Documents page
2. Find your uploaded document
3. Status should change from PENDING → PROCESSING → COMPLETED

### 3.3 View Extracted Text

1. Click on the completed document
2. View extracted text in the "Text" tab
3. Check metadata in the "Metadata" tab
4. Inspect extracted data in the "Data" tab

### 3.4 Search Documents

1. Go to Search page
2. Enter a search term
3. View matching documents

## Step 4: Configure AWS Textract (Optional)

AWS Textract is automatically configured with the deployment. However, you may want to:

### Enable Advanced Features

Edit `backend/lambdas/process.ts` to enable additional Textract features:

```typescript
FeatureTypes: [
  FeatureType.FORMS,
  FeatureType.TABLES,
  FeatureType.SIGNATURES,  // Add signature detection
  FeatureType.QUERIES,     // Add custom queries
]
```

### Adjust Confidence Thresholds

Modify the processing logic to filter results by confidence:

```typescript
if (block.Confidence && block.Confidence > 90) {
  // Only process high-confidence results
}
```

## Step 5: Monitor and Maintain

### View Logs

```bash
# Upload function logs
aws logs tail /aws/lambda/DocumentReaderStack-UploadFunction --follow

# Process function logs
aws logs tail /aws/lambda/DocumentReaderStack-ProcessFunction --follow
```

### Monitor Costs

- Check AWS Cost Explorer for service costs
- Set up billing alerts in AWS Budgets
- Monitor S3 storage usage
- Track DynamoDB read/write units

### Backup Data

DynamoDB point-in-time recovery is enabled by default. To create on-demand backup:

```bash
aws dynamodb create-backup \
  --table-name DocumentReader-Documents \
  --backup-name my-backup-$(date +%Y%m%d)
```

## Troubleshooting

### Backend Issues

**Problem**: CDK deployment fails
- **Solution**: Check AWS credentials, ensure CDK is bootstrapped, verify IAM permissions

**Problem**: Lambda timeout
- **Solution**: Increase timeout in `document-reader-stack.ts` (currently 5 minutes)

**Problem**: Textract errors
- **Solution**: Verify file format is supported, check file size is under 10MB

### Frontend Issues

**Problem**: CORS errors
- **Solution**: Verify API Gateway CORS configuration, check API URL in config

**Problem**: Upload fails
- **Solution**: Check presigned URL expiration, verify S3 bucket permissions

**Problem**: Documents not appearing
- **Solution**: Check DynamoDB table, verify Lambda processing logs

## Cost Estimates

Based on 1000 documents/month:

- **AWS Textract**: ~$15 (1000 pages × $0.015)
- **Lambda**: ~$1 (minimal execution time)
- **S3**: ~$0.50 (10GB storage)
- **DynamoDB**: ~$1 (on-demand pricing)
- **API Gateway**: ~$0.50 (1M requests free tier)

**Total**: ~$18/month

## Security Best Practices

1. **Enable AWS CloudTrail** for audit logging
2. **Use AWS WAF** to protect API Gateway
3. **Implement authentication** with Amazon Cognito
4. **Enable S3 versioning** for document recovery
5. **Use VPC endpoints** for private access
6. **Rotate IAM credentials** regularly
7. **Enable AWS GuardDuty** for threat detection

## Cleanup

To remove all resources and stop incurring charges:

```bash
# Delete frontend (if using S3)
aws s3 rb s3://my-document-reader-frontend --force

# Delete backend
cd reader/backend
cdk destroy
```

Confirm deletion when prompted.

## Next Steps

- Add user authentication with Amazon Cognito
- Implement document versioning
- Add support for multi-page PDFs
- Integrate with Amazon Comprehend for entity extraction
- Add Amazon Translate for multi-language support
- Implement document classification with Amazon Rekognition
- Add real-time notifications with Amazon SNS
- Create document analytics dashboard

## Support

For issues or questions:
- Check AWS Textract documentation: https://docs.aws.amazon.com/textract/
- Review CloudWatch logs for errors
- Check AWS service health dashboard
- Consult AWS support if needed
