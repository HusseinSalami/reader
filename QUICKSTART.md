# Document Reader - Quick Start Guide

## What You Just Deployed (Backend)

✅ **API Gateway** - REST API for document operations  
✅ **Lambda Functions** - Serverless processing  
✅ **S3 Bucket** - Document storage  
✅ **DynamoDB** - Metadata storage  
✅ **AWS Textract** - AI text extraction  
✅ **CloudFront + S3** - Frontend hosting (infrastructure ready)

## Next Steps: Deploy the Frontend

You have **3 options**:

### Option 1: Automatic Frontend Deployment (Easiest)

```bash
cd reader
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

This will:
- ✅ Auto-detect your API URL
- ✅ Build the frontend
- ✅ Deploy to S3 + CloudFront
- ✅ Give you the URL to access

**Done in ~2 minutes!**

---

### Option 2: Complete Redeployment

If you want to redeploy everything from scratch:

```bash
cd reader
chmod +x deploy-all.sh
./deploy-all.sh
```

This redeploys both backend and frontend.

---

### Option 3: Local Development

Test locally without deploying frontend:

```bash
cd reader/frontend
npm install

# Get your API URL from the backend deployment outputs
# Update src/config.ts:
export const API_URL = 'https://YOUR-API-URL.execute-api.us-east-1.amazonaws.com/prod/';

# Start dev server
npm run dev
```

Visit http://localhost:3000

---

## What's the Difference?

| Method | Backend | Frontend | Best For |
|--------|---------|----------|----------|
| `deploy-frontend.sh` | Uses existing | Deploys to CloudFront | Quick frontend updates |
| `deploy-all.sh` | Redeploys | Deploys to CloudFront | Fresh deployment |
| Local dev | Uses existing | Runs locally | Development/testing |

---

## After Deployment

Once frontend is deployed, you'll get a CloudFront URL like:

```
https://d1234567890.cloudfront.net
```

### Test the Application

1. **Upload a Document**
   - Go to Upload page
   - Drag & drop a PDF or image
   - Click Upload

2. **View Processing**
   - Go to Documents page
   - Watch status change: PENDING → PROCESSING → COMPLETED

3. **View Results**
   - Click on completed document
   - See extracted text
   - View metadata (dates, emails, etc.)
   - Download original

4. **Search**
   - Go to Search page
   - Enter keywords
   - Find documents by content

---

## Troubleshooting

**Frontend not updating?**
```bash
# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR-DIST-ID \
  --paths "/*"
```

**Need to update frontend only?**
```bash
./deploy-frontend.sh
```

**Want to see logs?**
```bash
# Backend logs
aws logs tail /aws/lambda/DocumentReaderStack-ProcessFunction --follow

# List all log groups
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/DocumentReaderStack
```

**Cost concerns?**
- Free tier covers most usage initially
- ~$18/month for 1000 documents after free tier
- Delete everything: `cd backend && cdk destroy`

---

## Architecture Overview

```
User Browser
    ↓
CloudFront (Frontend)
    ↓
API Gateway
    ↓
Lambda Functions
    ↓
┌─────────────┬──────────────┬─────────────┐
│  S3 Bucket  │  DynamoDB    │  Textract   │
│  (Docs)     │  (Metadata)  │  (AI OCR)   │
└─────────────┴──────────────┴─────────────┘
```

---

## Quick Commands Reference

```bash
# Deploy frontend only
./deploy-frontend.sh

# Deploy everything
./deploy-all.sh

# Local development
cd frontend && npm run dev

# View backend logs
aws logs tail /aws/lambda/DocumentReaderStack-ProcessFunction --follow

# Delete everything
cd backend && cdk destroy
```

---

## What's Next?

- Add authentication with Amazon Cognito
- Implement document versioning
- Add multi-language support with Amazon Translate
- Create analytics dashboard
- Add email notifications with Amazon SES

See [DEPLOYMENT.md](DEPLOYMENT.md) for advanced configuration.
