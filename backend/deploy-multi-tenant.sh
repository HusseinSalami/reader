#!/bin/bash

# Multi-Tenant Document Platform - Deployment Script
# Deploys the new multi-tenant infrastructure

set -e

echo "🚀 Multi-Tenant Document Platform - Deployment"
echo "=============================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Loaded configuration from .env"
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Check AWS credentials
echo ""
echo "📋 Checking AWS credentials..."
if ! aws sts get-caller-identity --region $AWS_REGION > /dev/null 2>&1; then
    echo "❌ Error: AWS credentials not configured or expired"
    echo "Please run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region $AWS_REGION)
echo "✅ AWS Account: $ACCOUNT_ID"
echo "✅ AWS Region: $AWS_REGION"

# Bootstrap CDK (if needed)
echo ""
echo "🔧 Checking CDK bootstrap..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION > /dev/null 2>&1; then
    echo "📦 Bootstrapping CDK..."
    npx cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION
else
    echo "✅ CDK already bootstrapped"
fi

# Deploy stack
echo ""
echo "🚀 Deploying DocumentPlatformStack..."
echo ""
npx cdk deploy DocumentPlatformStack --require-approval never

# Get outputs
echo ""
echo "📊 Deployment Outputs:"
echo "===================="
aws cloudformation describe-stacks \
    --stack-name DocumentPlatformStack \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Test customer registration: POST /auth/register"
echo "2. Test login: POST /auth/login"
echo "3. Continue with Phase 1 remaining tasks"
