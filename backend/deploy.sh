#!/bin/bash

# Document Reader Backend Deployment Script

set -e

echo "🚀 Document Reader - Backend Deployment"
echo "========================================"
echo ""

# Check for required tools
echo "🔍 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed"
    echo "   Install from: https://aws.amazon.com/cli/"
    exit 1
fi

# Check for CDK - use npx if not globally installed
if ! command -v cdk &> /dev/null; then
    echo "⚠️  AWS CDK not found globally, will use npx cdk"
    CDK_CMD="npx cdk"
else
    CDK_CMD="cdk"
    echo "✅ AWS CDK found"
fi

echo "✅ Prerequisites check passed"
echo ""

# Load environment variables if .env exists
if [ -f .env ]; then
    echo "📝 Loading configuration from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  No .env file found. Using AWS CLI configuration or environment variables."
fi

# Check for AWS account ID
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "🔍 Detecting AWS account from CLI configuration..."
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
    
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        echo "❌ Error: AWS_ACCOUNT_ID not set and unable to detect from AWS CLI"
        echo ""
        echo "Please either:"
        echo "  1. Create a .env file with AWS_ACCOUNT_ID (copy from .env.example)"
        echo "  2. Set environment variable: export AWS_ACCOUNT_ID=123456789012"
        echo "  3. Configure AWS CLI: aws configure"
        exit 1
    fi
fi

# Set default region if not specified
AWS_REGION=${AWS_REGION:-us-east-1}

echo ""
echo "📋 Deployment Configuration:"
echo "   Account: $AWS_ACCOUNT_ID"
echo "   Region:  $AWS_REGION"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Bootstrap CDK if needed
echo "🔧 Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION >/dev/null 2>&1; then
    echo "🎯 Bootstrapping CDK (first-time setup)..."
    $CDK_CMD bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
else
    echo "✅ CDK already bootstrapped"
fi

# Deploy the stack
echo ""
echo "🚀 Deploying DocumentReaderStack..."
export AWS_ACCOUNT_ID
export AWS_REGION
$CDK_CMD deploy --require-approval never

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Copy the ApiUrl from the outputs above"
echo "   2. Update frontend/src/config.ts with the API URL"
echo "   3. Deploy the frontend"
echo ""
