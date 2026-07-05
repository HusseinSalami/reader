#!/bin/bash

# Integration Test Runner
# Runs the exam grading workflow integration test with proper AWS configuration

set -e

echo "🧪 Exam Grading Integration Test"
echo "================================="
echo ""

# Check AWS credentials
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ AWS credentials are not configured or have expired"
  echo ""
  echo "Please run one of the following:"
  echo "  - aws sso login --profile YOUR_PROFILE"
  echo "  - aws configure"
  echo ""
  exit 1
fi

echo "✓ AWS credentials are valid"
echo ""

# Get AWS account and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}

echo "AWS Configuration:"
echo "  Account: $AWS_ACCOUNT"
echo "  Region: $AWS_REGION"
echo ""

# Check if test exam exists
echo "Checking for test exam..."
EXAM_EXISTS=$(aws dynamodb get-item \
  --table-name DocumentPlatform-Exams \
  --key '{"PK":{"S":"CUSTOMER#test-customer-manual"},"SK":{"S":"EXAM#exam-818d4a37-3a14-4fc7-befd-368ad3215d29"}}' \
  --region $AWS_REGION \
  --query 'Item' \
  --output text 2>/dev/null || echo "")

if [ -z "$EXAM_EXISTS" ]; then
  echo "⚠️  Test exam not found!"
  echo ""
  echo "Please create the test exam first:"
  echo "  npx tsx create-test-exam-manual.ts"
  echo ""
  exit 1
fi

echo "✓ Test exam found"
echo ""

# Run the integration test
echo "Running integration test..."
echo ""

AWS_REGION=$AWS_REGION npm test -- tests/integration/exam-workflow.integration.test.ts

echo ""
echo "✅ Integration test completed!"
