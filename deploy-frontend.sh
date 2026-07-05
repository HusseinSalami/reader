#!/bin/bash

# Frontend-only deployment script
# Use this to update frontend without redeploying backend

set -e

echo "🎨 Document Reader - Frontend Deployment"
echo "========================================="
echo ""

# Check we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found"
    exit 1
fi

# Load region from backend .env if available
if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
fi

AWS_REGION=${AWS_REGION:-us-east-1}

# Get stack outputs
echo "📝 Retrieving deployment information (region: $AWS_REGION)..."
API_URL=$(aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
    echo "❌ Error: Backend stack not found or API URL not available in region $AWS_REGION"
    echo ""
    echo "Please deploy backend first with:"
    echo "   cd backend && ./deploy.sh"
    exit 1
fi

echo "✅ API URL: $API_URL"

# Check if CloudFront is deployed
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text 2>/dev/null || echo "")

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
    --output text 2>/dev/null || echo "")

FRONTEND_URL=$(aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$FRONTEND_BUCKET" ]; then
    echo ""
    echo "⚠️  CloudFront infrastructure not found in stack."
    echo ""
    echo "You have 2 options:"
    echo ""
    echo "1. Update backend to include CloudFront (recommended):"
    echo "   cd backend && ./deploy.sh"
    echo ""
    echo "2. Run frontend locally for testing:"
    echo "   cd frontend"
    echo "   npm install"
    echo "   # Update src/config.ts with: export const API_URL = '${API_URL}';"
    echo "   npm run dev"
    echo ""
    exit 1
fi

echo "✅ Frontend Bucket: $FRONTEND_BUCKET"

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Update config
echo "📝 Updating configuration..."
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

# Build
echo "🔨 Building..."
npm run build

# Deploy
echo "☁️  Uploading to S3..."
aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete --region $AWS_REGION

# Invalidate cache
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
    --distribution-id ${DISTRIBUTION_ID} \
    --paths "/*" > /dev/null

echo ""
echo "✅ Frontend deployed successfully!"
echo ""
echo "🌐 URL: ${FRONTEND_URL}"
echo ""
echo "💡 CloudFront may take a few minutes to propagate changes"
echo ""
