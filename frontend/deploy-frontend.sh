#!/bin/bash

# Deploy Frontend to CloudFront
# This script builds the frontend and prepares it for deployment

set -e

echo "🚀 Building Multi-Tenant Document Platform Frontend..."

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the frontend directory."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the frontend
echo "🔨 Building frontend..."
npm run build

echo "✅ Frontend build complete!"
echo ""
echo "📁 Build output is in: dist/"
echo ""
echo "To deploy to CloudFront:"
echo "1. Upload dist/ contents to S3 bucket"
echo "2. Invalidate CloudFront cache"
echo ""
echo "Manual deployment commands:"
echo "  aws s3 sync dist/ s3://YOUR-BUCKET-NAME/ --delete"
echo "  aws cloudfront create-invalidation --distribution-id YOUR-DIST-ID --paths '/*'"
echo ""
echo "Note: Automated CloudFront deployment will be added in Phase 6"
