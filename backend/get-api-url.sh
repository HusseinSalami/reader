#!/bin/bash

# Get API URL from deployed CDK stack

echo "🔍 Retrieving API URL from deployed stack..."
echo ""

# Try to get from outputs.json first
if [ -f "outputs.json" ]; then
  API_URL=$(cat outputs.json | grep -o '"ApiUrl"[^,]*' | grep -o 'https://[^"]*')
  if [ ! -z "$API_URL" ]; then
    echo "✓ Found API URL in outputs.json:"
    echo "  $API_URL"
    echo ""
    echo "To use in tests:"
    echo "  export API_URL=$API_URL"
    echo ""
    exit 0
  fi
fi

# Try to get from CDK
STACK_NAME=${STACK_NAME:-"MultiTenantDocumentPlatformStack"}

echo "Checking CloudFormation stack: $STACK_NAME"
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text 2>/dev/null)

if [ ! -z "$API_URL" ] && [ "$API_URL" != "None" ]; then
  echo "✓ Found API URL from CloudFormation:"
  echo "  $API_URL"
  echo ""
  echo "To use in tests:"
  echo "  export API_URL=$API_URL"
  echo ""
  
  # Save to .env for convenience
  if [ -f ".env" ]; then
    if grep -q "^API_URL=" .env; then
      # Update existing
      sed -i.bak "s|^API_URL=.*|API_URL=$API_URL|" .env
      echo "✓ Updated API_URL in .env file"
    else
      # Add new
      echo "" >> .env
      echo "# API Gateway URL (auto-detected)" >> .env
      echo "API_URL=$API_URL" >> .env
      echo "✓ Added API_URL to .env file"
    fi
  fi
  
  exit 0
fi

echo "❌ Could not find API URL"
echo ""
echo "Make sure the stack is deployed:"
echo "  cd backend"
echo "  npm run deploy"
echo ""
echo "Or manually set the API URL:"
echo "  export API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod"

exit 1
