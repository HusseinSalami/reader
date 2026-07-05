#!/bin/bash

# Complete Document Reader Deployment Script
# Deploys both backend and frontend

set -e

echo "🚀 Document Reader - Complete Deployment"
echo "=========================================="
echo ""

# Check we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Must run from the reader/ directory"
    exit 1
fi

# Step 1: Deploy Backend
echo "📦 Step 1: Deploying Backend Infrastructure..."
echo "=============================================="
cd backend

if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit backend/.env and set your AWS_ACCOUNT_ID"
    echo "   Then run this script again."
    exit 1
fi

# Run backend deployment
chmod +x deploy.sh
./deploy.sh

# Wait a moment for stack to stabilize
echo ""
echo "⏳ Waiting for stack outputs to be available..."
sleep 5

# Capture API URL from CloudFormation outputs
echo "📝 Retrieving API URL from deployment..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

# Retry if empty
if [ -z "$API_URL" ]; then
    echo "⏳ Stack still updating, waiting 10 more seconds..."
    sleep 10
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name DocumentReaderStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text 2>/dev/null || echo "")
fi

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text 2>/dev/null || echo "")

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
    --output text 2>/dev/null || echo "")

FRONTEND_URL=$(aws cloudformation describe-stacks \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
    echo "❌ Error: Could not retrieve API URL from stack outputs"
    exit 1
fi

echo "✅ API URL: $API_URL"
echo "✅ Frontend Bucket: $FRONTEND_BUCKET"
echo "✅ Distribution ID: $DISTRIBUTION_ID"

cd ..

# Step 2: Build and Deploy Frontend
echo ""
echo "🎨 Step 2: Building and Deploying Frontend..."
echo "=============================================="
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Update config with API URL
echo "📝 Updating frontend configuration..."
cat > src/config.ts << EOF
// Auto-generated configuration
export const API_URL = '${API_URL}';

export const config = {
  apiUrl: API_URL,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFormats: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
  ],
};
EOF

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Deploy to S3
echo "☁️  Uploading to S3..."
aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
    --distribution-id ${DISTRIBUTION_ID} \
    --paths "/*" > /dev/null

cd ..

# Final Summary
echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo ""
echo "🌐 Frontend URL: ${FRONTEND_URL}"
echo "🔗 API URL: ${API_URL}"
echo ""
echo "📝 Next Steps:"
echo "   1. Visit ${FRONTEND_URL}"
echo "   2. Upload a document to test"
echo "   3. Check CloudWatch logs if issues occur"
echo ""
echo "💡 Tip: CloudFront may take a few minutes to propagate changes"
echo ""
