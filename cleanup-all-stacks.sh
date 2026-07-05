#!/bin/bash

# Cleanup script to delete all stacks from the Document Reader project
# Account: 281129374677

set -e

echo "=========================================="
echo "Document Reader - Complete Stack Cleanup"
echo "Account: 281129374677"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current AWS account
CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")

if [ "$CURRENT_ACCOUNT" != "281129374677" ]; then
    echo -e "${RED}ERROR: Current AWS account ($CURRENT_ACCOUNT) does not match target account (281129374677)${NC}"
    echo "Please configure your AWS credentials for the correct account."
    exit 1
fi

echo -e "${GREEN}✓ Confirmed AWS account: $CURRENT_ACCOUNT${NC}"
echo ""

# List of stacks to delete (in order)
STACKS=(
    "DocumentReaderFrontend"
    "DocumentReaderMultiTenant"
    "DocumentReaderStack"
    "CDKToolkit"
)

echo "The following stacks will be deleted:"
for stack in "${STACKS[@]}"; do
    echo "  - $stack"
done
echo ""

read -p "Are you sure you want to delete ALL stacks? This cannot be undone! (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Starting cleanup process..."
echo ""

# Function to delete a stack
delete_stack() {
    local stack_name=$1
    
    echo -e "${YELLOW}Checking stack: $stack_name${NC}"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name "$stack_name" &>/dev/null; then
        echo -e "${YELLOW}Deleting stack: $stack_name${NC}"
        
        # Delete the stack
        aws cloudformation delete-stack --stack-name "$stack_name"
        
        echo "Waiting for stack deletion to complete..."
        aws cloudformation wait stack-delete-complete --stack-name "$stack_name" 2>/dev/null || {
            echo -e "${RED}Warning: Stack deletion may have failed or timed out${NC}"
            echo "Check AWS Console for details: https://console.aws.amazon.com/cloudformation"
        }
        
        echo -e "${GREEN}✓ Stack deleted: $stack_name${NC}"
    else
        echo -e "${YELLOW}Stack not found (may already be deleted): $stack_name${NC}"
    fi
    echo ""
}

# Delete stacks in order
for stack in "${STACKS[@]}"; do
    delete_stack "$stack"
done

echo ""
echo "=========================================="
echo "Additional Cleanup Steps"
echo "=========================================="
echo ""
echo "The following resources may need manual cleanup:"
echo ""
echo "1. S3 Buckets (not auto-deleted by CloudFormation):"
echo "   - Document upload buckets"
echo "   - Frontend hosting buckets"
echo "   - CDK staging buckets"
echo ""
echo "2. DynamoDB Tables (if retain policy was set):"
echo "   - DocumentPlatform table"
echo ""
echo "3. CloudWatch Log Groups:"
echo "   - Lambda function logs"
echo ""
echo "To list S3 buckets:"
echo "  aws s3 ls"
echo ""
echo "To delete an S3 bucket:"
echo "  aws s3 rb s3://bucket-name --force"
echo ""
echo "To list DynamoDB tables:"
echo "  aws dynamodb list-tables"
echo ""
echo "To delete a DynamoDB table:"
echo "  aws dynamodb delete-table --table-name TableName"
echo ""
echo "To list CloudWatch log groups:"
echo "  aws logs describe-log-groups --query 'logGroups[*].logGroupName'"
echo ""
echo "To delete a log group:"
echo "  aws logs delete-log-group --log-group-name /aws/lambda/function-name"
echo ""
echo -e "${GREEN}Stack cleanup complete!${NC}"
