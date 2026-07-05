# Document Reader Backend

Serverless backend infrastructure for document scanning and digitization using AWS CDK.

## Architecture

- **AWS Lambda**: Serverless compute for API handlers and document processing
- **Amazon S3**: Document storage with lifecycle policies
- **Amazon DynamoDB**: Document metadata and extracted text storage
- **AWS Textract**: AI-powered text extraction and document analysis
- **API Gateway**: RESTful API endpoints

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`
- AWS account with permissions for:
  - Lambda, S3, DynamoDB, API Gateway, Textract, IAM, CloudFormation

## Installation

```bash
cd reader/backend
npm install
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and set your AWS account ID:
```bash
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
```

Or the deployment script will auto-detect from AWS CLI.

## Deployment

### Option 1: Using Deployment Script (Recommended)

```bash
# Make script executable (Linux/Mac)
chmod +x deploy.sh
./deploy.sh

# Windows
deploy.bat
```

The script will:
- Auto-detect AWS account from CLI if not in .env
- Install dependencies if needed
- Bootstrap CDK if needed
- Deploy the stack

### Option 2: Manual Deployment

1. Set environment variables:
```bash
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-east-1
```

2. Bootstrap CDK (first time only):
```bash
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
```

3. Deploy the stack:
```bash
npm run deploy
```

### Outputs

After deployment, note these outputs:
- `ApiUrl`: Your API Gateway endpoint
- `BucketName`: S3 bucket for documents
- `TableName`: DynamoDB table name

## API Endpoints

### POST /documents
Generate presigned URL for document upload.

**Request:**
```json
{
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "userId": "user-123",
  "metadata": {}
}
```

**Response:**
```json
{
  "documentId": "uuid",
  "uploadUrl": "https://...",
  "message": "Upload URL generated successfully"
}
```

### GET /documents
List all documents with optional filters.

**Query Parameters:**
- `userId`: Filter by user
- `status`: Filter by status (PENDING, PROCESSING, COMPLETED, FAILED)
- `limit`: Max results (default: 20)
- `lastKey`: Pagination token

### GET /documents/{id}
Get specific document with extracted data.

**Response includes:**
- Document metadata
- Extracted text
- Key-value pairs
- Tables
- Download URL

### GET /documents/search?q={query}
Search documents by content or filename.

**Query Parameters:**
- `q`: Search term (required)
- `limit`: Max results (default: 20)

## Document Processing Flow

1. Client requests upload URL via POST /documents
2. Client uploads file directly to S3 using presigned URL
3. S3 triggers Lambda function automatically
4. Lambda processes document with AWS Textract:
   - Extracts text, lines, and words
   - Analyzes forms and tables
   - Extracts key-value pairs
   - Detects dates, emails, phone numbers
5. Results stored in DynamoDB
6. Client retrieves processed document via GET /documents/{id}

## AWS Textract Features

- **Text Detection**: Extract all text from documents
- **Form Analysis**: Extract key-value pairs from forms
- **Table Extraction**: Identify and extract table data
- **High Accuracy**: 95%+ confidence on most documents

## Cost Optimization

- S3 Intelligent-Tiering for automatic cost optimization
- DynamoDB on-demand billing (pay per request)
- Lambda charged only during execution
- S3 lifecycle policy moves old documents to cheaper storage

## Monitoring

View logs in CloudWatch:
```bash
aws logs tail /aws/lambda/DocumentReaderStack-UploadFunction --follow
aws logs tail /aws/lambda/DocumentReaderStack-ProcessFunction --follow
```

## Cleanup

Remove all resources:
```bash
cdk destroy
```

## Supported File Formats

- PDF documents
- PNG images
- JPEG/JPG images
- TIFF images

Maximum file size: 10MB (configurable)

## Security

- CORS enabled for frontend access
- Presigned URLs expire after 1 hour
- S3 bucket encryption at rest
- DynamoDB point-in-time recovery enabled
- IAM roles with least privilege access

## Troubleshooting

**Issue**: Textract fails with "InvalidParameterException"
- **Solution**: Ensure document is in supported format and under 10MB

**Issue**: Lambda timeout
- **Solution**: Increase timeout in CDK stack (currently 5 minutes for processing)

**Issue**: CORS errors
- **Solution**: Verify API Gateway CORS configuration matches frontend origin
