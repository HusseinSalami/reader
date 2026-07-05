#!/bin/bash

# Deploy and Test - One Command to Rule Them All
# This script deploys the backend and automatically tests it

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Document Processing Pipeline - Deploy & Test             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Run tests
echo -e "${BLUE}Step 1: Running tests...${NC}"
npm test
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed. Fix tests before deploying.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ All tests passed${NC}"
echo ""

# Step 2: Deploy
echo -e "${BLUE}Step 2: Deploying to AWS...${NC}"
echo -e "${YELLOW}⏳ This will take 5-10 minutes...${NC}"
echo ""

# Capture CDK output to a file
CDK_OUTPUT=$(mktemp)
cdk deploy --require-approval never --outputs-file cdk.out/outputs.json 2>&1 | tee "$CDK_OUTPUT"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    rm -f "$CDK_OUTPUT"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Deployment successful${NC}"
echo ""

# Step 3: Extract API URL
echo -e "${BLUE}Step 3: Getting API URL...${NC}"

# Try multiple methods to get API URL
API_URL=""

# Method 1: From outputs.json
if [ -f "cdk.out/outputs.json" ]; then
    API_URL=$(cat cdk.out/outputs.json | jq -r '.MultiTenantDocumentPlatformStack.ApiUrl' 2>/dev/null || echo "")
fi

# Method 2: From CloudFormation
if [ -z "$API_URL" ] || [ "$API_URL" = "null" ]; then
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name MultiTenantDocumentPlatformStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text 2>/dev/null || echo "")
fi

# Method 3: Parse from CDK output (macOS compatible)
if [ -z "$API_URL" ] || [ "$API_URL" = "null" ] || [ "$API_URL" = "None" ]; then
    API_URL=$(grep 'ApiUrl = ' "$CDK_OUTPUT" | sed 's/.*ApiUrl = //' | awk '{print $1}' | head -1 || echo "")
fi

rm -f "$CDK_OUTPUT"

if [ -z "$API_URL" ] || [ "$API_URL" = "null" ] || [ "$API_URL" = "None" ]; then
    echo -e "${RED}❌ Could not extract API URL${NC}"
    echo ""
    echo "Please get it manually:"
    echo "  aws cloudformation describe-stacks --stack-name MultiTenantDocumentPlatformStack \\"
    echo "    --query 'Stacks[0].Outputs[?OutputKey==\`ApiUrl\`].OutputValue' --output text"
    echo ""
    echo "Then run: API_URL=<your-url> ./test-processing-pipeline.sh"
    exit 1
fi

echo -e "${GREEN}✅ API URL: $API_URL${NC}"
echo ""

# Step 4: Wait a moment for resources to be ready
echo -e "${BLUE}Step 4: Waiting for resources to be ready...${NC}"
sleep 10
echo -e "${GREEN}✅ Ready${NC}"
echo ""

# Step 5: Run tests
echo -e "${BLUE}Step 5: Testing the pipeline...${NC}"
echo ""

export API_URL
./test-processing-pipeline.sh

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 Deployment and Testing Complete!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Your API is live at:${NC}"
echo -e "  $API_URL"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Check AWS Console → Step Functions for execution details"
echo "  2. Check CloudWatch Logs for Lambda outputs"
echo "  3. Update frontend to use new API (Option B)"
echo ""
