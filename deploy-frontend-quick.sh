#!/bin/bash

echo "🚀 Deploying Frontend to AWS..."

cd frontend

# Get stack outputs
echo "📋 Getting stack information..."
BUCKET=$(aws cloudformation describe-stacks --stack-name DocumentPlatformStack --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' --output text)
DIST_ID=$(aws cloudformation describe-stacks --stack-name DocumentPlatformStack --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' --output text)

if [ -z "$BUCKET" ] || [ -z "$DIST_ID" ]; then
  echo "❌ Error: Could not get stack outputs. Make sure:"
  echo "   1. AWS credentials are valid"
  echo "   2. Stack 'DocumentPlatformStack' exists in us-east-1"
  exit 1
fi

echo "📦 Bucket: $BUCKET"
echo "🌐 Distribution: $DIST_ID"

# Upload to S3
echo ""
echo "📤 Uploading to S3..."
aws s3 sync dist/ s3://$BUCKET/ --delete --region us-east-1

if [ $? -ne 0 ]; then
  echo "❌ S3 upload failed"
  exit 1
fi

echo "✅ S3 upload complete!"

# Invalidate CloudFront
echo ""
echo "🔄 Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id $DIST_ID --paths '/*' --region us-east-1 --query 'Invalidation.Id' --output text)

if [ $? -ne 0 ]; then
  echo "❌ CloudFront invalidation failed"
  exit 1
fi

echo "✅ CloudFront invalidation created: $INVALIDATION_ID"
echo ""
echo "🎉 Frontend deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Wait 1-2 minutes for CloudFront to update"
echo "   2. Hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+R)"
echo "   3. Navigate to a document with array fields to see the toggle"
