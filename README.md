# Document Reader Service

A serverless document scanning and digitization service built with native AWS services.

## Architecture

- **AWS Textract**: Document OCR and text extraction
- **AWS Lambda**: Serverless compute for processing
- **Amazon S3**: Document storage
- **Amazon DynamoDB**: Metadata and extracted text storage
- **API Gateway**: REST API endpoints
- **AWS Amplify**: Frontend hosting (optional)

## Features

- Upload documents (PDF, PNG, JPG, TIFF)
- Automatic text extraction using AWS Textract
- Document classification and tagging
- Full-text search capabilities
- Metadata extraction (dates, entities, key-value pairs)
- Document versioning
- Secure storage with presigned URLs
- Real-time processing status updates

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk` (optional, can use npx)
- AWS account with appropriate permissions

### Option 1: Complete Deployment (Recommended)

Deploy everything (backend + frontend) with one command:

```bash
cd reader

# Make script executable
chmod +x deploy-all.sh

# Deploy everything
./deploy-all.sh
```

This will:
1. Deploy backend infrastructure (Lambda, S3, DynamoDB, API Gateway)
2. Create CloudFront distribution for frontend
3. Build and deploy frontend automatically
4. Configure everything and give you the URL

### Option 2: Step-by-Step Deployment

#### Step 1: Setup

```bash
cd reader

# Run setup script to install all dependencies
chmod +x setup.sh
./setup.sh
```

#### Step 2: Configure Backend

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env and set your AWS account ID
# AWS_ACCOUNT_ID=123456789012
# AWS_REGION=us-east-1
```

#### Step 3: Deploy Backend

```bash
chmod +x deploy.sh
./deploy.sh
```

**Copy the ApiUrl from the outputs!**

#### Step 4: Deploy Frontend

```bash
cd ..
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

This automatically:
- Retrieves API URL from backend stack
- Updates frontend configuration
- Builds the frontend
- Deploys to S3 + CloudFront
- Gives you the frontend URL

### Option 3: Local Development

For local testing without deploying frontend:

```bash
# Deploy backend first
cd backend
./deploy.sh

# Copy the API URL from outputs

# Run frontend locally
cd ../frontend
npm install

# Update src/config.ts with your API URL
# Then start dev server
npm run dev
```

Access at http://localhost:3000

## Project Structure

```
reader/
├── backend/
│   ├── infrastructure/        # CDK infrastructure code
│   │   ├── app.ts            # CDK app entry point
│   │   └── document-reader-stack.ts  # Main stack definition
│   ├── lambdas/              # Lambda function handlers
│   │   ├── upload.ts         # Generate presigned URLs
│   │   ├── process.ts        # Textract processing
│   │   ├── get-document.ts   # Retrieve document
│   │   ├── list-documents.ts # List documents
│   │   └── search.ts         # Search documents
│   ├── .env.example          # Environment template
│   ├── deploy.sh             # Deployment script (Linux/Mac)
│   ├── deploy.bat            # Deployment script (Windows)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client
│   │   └── config.ts        # Configuration
│   └── package.json
├── setup.sh                  # Setup script (Linux/Mac)
├── setup.bat                 # Setup script (Windows)
├── DEPLOYMENT.md            # Detailed deployment guide
└── README.md                # This file
```

## Usage

### Upload a Document

1. Navigate to the Upload page
2. Drag and drop a file or click to browse
3. Supported formats: PDF, PNG, JPG, TIFF (max 10MB)
4. Click "Upload Document"
5. Wait for processing to complete

### View Documents

1. Navigate to Documents page
2. Filter by status (All, Completed, Processing, etc.)
3. Click on a document to view details

### Search Documents

1. Navigate to Search page
2. Enter search terms
3. View matching documents with highlighted content

### Document Details

- View extracted text
- Inspect metadata (dates, emails, phone numbers)
- View extracted data (key-value pairs, tables)
- Download original document

## Cost Estimate

Based on 1000 documents/month:

- **AWS Textract**: ~$15 (1000 pages × $0.015)
- **Lambda**: ~$1 (minimal execution time)
- **S3**: ~$0.50 (10GB storage)
- **DynamoDB**: ~$1 (on-demand pricing)
- **API Gateway**: ~$0.50 (1M requests free tier)

**Total**: ~$18/month

## Cleanup

To remove all resources and stop charges:

```bash
cd backend
cdk destroy
```

## Documentation

- [Backend README](backend/README.md) - Backend deployment and API details
- [Frontend README](frontend/README.md) - Frontend setup and customization
- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide with all options

## Troubleshooting

**Issue**: Deployment fails with "AWS account not found"
- **Solution**: Set AWS_ACCOUNT_ID in backend/.env or configure AWS CLI

**Issue**: CORS errors in frontend
- **Solution**: Verify API URL in frontend/src/config.ts matches deployed API

**Issue**: Documents stuck in PROCESSING
- **Solution**: Check Lambda logs in CloudWatch for errors

**Issue**: Textract errors
- **Solution**: Ensure file format is supported and under 10MB

## Support

For detailed instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)

For AWS Textract documentation: https://docs.aws.amazon.com/textract/
