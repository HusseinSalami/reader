#!/bin/bash

echo "🔍 Debugging CloudFormation Stacks"
echo "===================================="
echo ""

# Load region from backend .env if available
if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
fi

AWS_REGION=${AWS_REGION:-us-east-1}

echo "Using region: $AWS_REGION"
echo ""

echo "📋 All CloudFormation Stacks:"
aws cloudformation list-stacks \
    --region $AWS_REGION \
    --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
    --query 'StackSummaries[*].[StackName,StackStatus]' \
    --output table

echo ""
echo "🔍 Looking for DocumentReaderStack specifically..."
aws cloudformation describe-stacks \
    --region $AWS_REGION \
    --stack-name DocumentReaderStack 2>&1

echo ""
echo "🔍 Checking AWS account..."
aws sts get-caller-identity
