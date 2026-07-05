#!/bin/bash

# Check deployment status and outputs

echo "🔍 Checking DocumentReaderStack deployment..."
echo ""

# Load region from backend .env if available
if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
fi

AWS_REGION=${AWS_REGION:-us-east-1}

echo "Using region: $AWS_REGION"
echo ""

# Check if stack exists
STACK_STATUS=$(aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
    echo "❌ Stack not found in region $AWS_REGION"
    echo ""
    echo "Please deploy first:"
    echo "   cd backend && ./deploy.sh"
    exit 1
fi

echo "Stack Status: $STACK_STATUS"
echo ""

# Get all outputs
echo "📋 Stack Outputs:"
echo "=================="
aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue,Description]' \
    --output table 2>/dev/null || echo "No outputs available"

echo ""

# Get specific values
API_URL=$(aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text 2>/dev/null || echo "")

FRONTEND_URL=$(aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

echo "📝 Quick Reference:"
echo "==================="
if [ -n "$API_URL" ]; then
    echo "✅ API URL: $API_URL"
else
    echo "❌ API URL: Not found"
fi

if [ -n "$FRONTEND_BUCKET" ]; then
    echo "✅ Frontend Bucket: $FRONTEND_BUCKET"
    echo "✅ Frontend URL: $FRONTEND_URL"
    echo ""
    echo "🎯 Next step: Deploy frontend"
    echo "   ./deploy-frontend.sh"
else
    echo "⚠️  Frontend infrastructure: Not deployed"
    echo ""
    echo "🎯 Next step: Run locally"
    echo "   ./run-local.sh"
fi

echo ""
