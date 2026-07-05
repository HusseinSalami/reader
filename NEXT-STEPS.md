# What To Do Now - You've Deployed the Backend ✅

Your backend is deployed! Here are your options:

## Option 1: Run Frontend Locally (Quickest - For Testing)

```bash
cd reader
chmod +x run-local.sh
./run-local.sh
```

This will:
- ✅ Auto-detect your backend API URL
- ✅ Configure the frontend automatically
- ✅ Start dev server at http://localhost:3000

**Perfect for testing and development!**

---

## Option 2: Deploy Frontend to AWS (Production)

First, update your backend to include CloudFront:

```bash
cd reader/backend
./deploy.sh
```

Then deploy the frontend:

```bash
cd ..
./deploy-frontend.sh
```

This gives you a production CloudFront URL.

---

## Option 3: Manual Local Setup

If you prefer manual control:

```bash
cd reader/frontend
npm install

# Get your API URL
aws cloudformation describe-stacks \
  --stack-name DocumentReaderStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text

# Update src/config.ts with the API URL above:
# export const API_URL = 'https://YOUR-API-URL.execute-api.us-east-1.amazonaws.com/prod/';

npm run dev
```

---

## Recommended: Start with Local Testing

```bash
./run-local.sh
```

Then visit http://localhost:3000 and:

1. **Upload a document** (PDF or image)
2. **Watch it process** (PENDING → PROCESSING → COMPLETED)
3. **View extracted text** and metadata
4. **Search** across documents

Once you're happy with it, deploy to production with Option 2!

---

## Quick Commands

```bash
# Run locally (easiest)
./run-local.sh

# Deploy frontend to AWS
./deploy-frontend.sh

# Redeploy everything
./deploy-all.sh

# View backend logs
aws logs tail /aws/lambda/DocumentReaderStack-ProcessFunction --follow
```

---

## Your Current Setup

✅ **Backend Deployed**
- API Gateway
- Lambda Functions  
- S3 for documents
- DynamoDB for metadata
- AWS Textract integration

⏳ **Frontend Options**
- Run locally (instant)
- Deploy to CloudFront (production)

Choose what works best for you!
