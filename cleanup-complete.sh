#!/bin/bash

# Complete cleanup script - deletes stacks AND associated resources
# Account: 281129374677

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "Document Reader - COMPLETE CLEANUP"
echo "Account: 281129374677"
echo "=========================================="
echo ""

# Verify AWS account
CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")

if [ "$CURRENT_ACCOUNT" != "281129374677" ]; then
    echo -e "${RED}ERROR: Current AWS account ($CURRENT_ACCOUNT) does not match target account (281129374677)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Confirmed AWS account: $CURRENT_ACCOUNT${NC}"
echo ""

echo -e "${RED}WARNING: This will delete:${NC}"
echo "  • All CloudFormation stacks"
echo "  • All S3 buckets (including uploaded documents)"
echo "  • DynamoDB tables (all data will be lost)"
echo "  • CloudWatch log groups"
echo "  • All Lambda functions"
echo "  • API Gateway"
echo "  • Step Functions state machines"
echo ""
echo -e "${RED}THIS CANNOT BE UNDONE!${NC}"
echo ""

read -p "Type 'DELETE EVERYTHING' to confirm: " confirm
if [ "$confirm" != "DELETE EVERYTHING" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Starting complete cleanup...${NC}"
echo ""

# Step 1: Empty and delete S3 buckets
echo "=========================================="
echo "Step 1: Cleaning up S3 Buckets"
echo "=========================================="
echo ""

S3_BUCKETS=$(aws s3 ls | grep -E 'documentreader|document-reader|cdk-' | awk '{print $3}' || echo "")

if [ -n "$S3_BUCKETS" ]; then
    echo "Found S3 buckets:"
    echo "$S3_BUCKETS"
    echo ""
    
    for bucket in $S3_BUCKETS; do
        echo -e "${YELLOW}Emptying bucket: $bucket${NC}"
        aws s3 rm s3://$bucket --recursive 2>/dev/null || echo "  (already empty or error)"
        
        echo -e "${YELLOW}Deleting bucket: $bucket${NC}"
        aws s3 rb s3://$bucket --force 2>/dev/null || echo "  (already deleted or error)"
        echo ""
    done
else
    echo "No S3 buckets found."
fi

# Step 2: Delete CloudFormation stacks
echo "=========================================="
echo "Step 2: Deleting CloudFormation Stacks"
echo "=========================================="
echo ""

STACKS=(
    "DocumentReaderFrontend"
    "DocumentReaderMultiTenant"
    "DocumentReaderStack"
)

for stack in "${STACKS[@]}"; do
    if aws cloudformation describe-stacks --stack-name "$stack" &>/dev/null; then
        echo -e "${YELLOW}Deleting stack: $stack${NC}"
        aws cloudformation delete-stack --stack-name "$stack"
        
        echo "Waiting for deletion..."
        aws cloudformation wait stack-delete-complete --stack-name "$stack" 2>/dev/null || {
            echo -e "${RED}Warning: Stack deletion may have failed${NC}"
        }
        echo -e "${GREEN}✓ Deleted: $stack${NC}"
    else
        echo -e "${YELLOW}Stack not found: $stack${NC}"
    fi
    echo ""
done

# Step 3: Delete DynamoDB tables
echo "=========================================="
echo "Step 3: Deleting DynamoDB Tables"
echo "=========================================="
echo ""

TABLES=$(aws dynamodb list-tables --query 'TableNames[?contains(@, `DocumentPlatform`) || contains(@, `DocumentReader`)]' --output text || echo "")

if [ -n "$TABLES" ]; then
    for table in $TABLES; do
        echo -e "${YELLOW}Deleting table: $table${NC}"
        aws dynamodb delete-table --table-name "$table" 2>/dev/null || echo "  (already deleted or error)"
    done
else
    echo "No DynamoDB tables found."
fi
echo ""

# Step 4: Delete CloudWatch log groups
echo "=========================================="
echo "Step 4: Deleting CloudWatch Log Groups"
echo "=========================================="
echo ""

LOG_GROUPS=$(aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `/aws/lambda/DocumentReader`) || contains(logGroupName, `/aws/lambda/document-reader`)].logGroupName' --output text || echo "")

if [ -n "$LOG_GROUPS" ]; then
    for log_group in $LOG_GROUPS; do
        echo -e "${YELLOW}Deleting log group: $log_group${NC}"
        aws logs delete-log-group --log-group-name "$log_group" 2>/dev/null || echo "  (already deleted or error)"
    done
else
    echo "No log groups found."
fi
echo ""

# Step 5: Delete CDK Toolkit (optional)
echo "=========================================="
echo "Step 5: CDK Toolkit Stack (Optional)"
echo "=========================================="
echo ""

read -p "Delete CDKToolkit stack? This affects ALL CDK projects in this account (yes/no): " delete_cdk
if [ "$delete_cdk" = "yes" ]; then
    if aws cloudformation describe-stacks --stack-name "CDKToolkit" &>/dev/null; then
        echo -e "${YELLOW}Deleting CDKToolkit stack${NC}"
        aws cloudformation delete-stack --stack-name "CDKToolkit"
        echo "Waiting for deletion..."
        aws cloudformation wait stack-delete-complete --stack-name "CDKToolkit" 2>/dev/null || true
        echo -e "${GREEN}✓ CDKToolkit deleted${NC}"
    fi
    
    # Delete CDK staging bucket
    CDK_BUCKET=$(aws s3 ls | grep 'cdk-' | awk '{print $3}' | head -1 || echo "")
    if [ -n "$CDK_BUCKET" ]; then
        echo -e "${YELLOW}Emptying CDK bucket: $CDK_BUCKET${NC}"
        aws s3 rm s3://$CDK_BUCKET --recursive 2>/dev/null || true
        aws s3 rb s3://$CDK_BUCKET --force 2>/dev/null || true
    fi
else
    echo "Skipping CDKToolkit deletion."
fi

echo ""
echo "=========================================="
echo -e "${GREEN}CLEANUP COMPLETE!${NC}"
echo "=========================================="
echo ""
echo "All Document Reader resources have been deleted from account $CURRENT_ACCOUNT"
echo ""
echo "To verify cleanup, check:"
echo "  • CloudFormation: https://console.aws.amazon.com/cloudformation"
echo "  • S3: https://console.aws.amazon.com/s3"
echo "  • DynamoDB: https://console.aws.amazon.com/dynamodb"
echo ""
