#!/bin/bash

# Run frontend locally pointing to deployed backend

set -e

echo "🖥️  Document Reader - Local Development"
echo "========================================"
echo ""

# Load region from backend .env if available
if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
fi

# Set default region
AWS_REGION=${AWS_REGION:-us-east-1}

# Get API URL from deployed stack
echo "📝 Retrieving API URL from backend (region: $AWS_REGION)..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name DocumentReaderStack \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
    echo "❌ Error: Backend stack not found in region $AWS_REGION"
    echo ""
    echo "Please either:"
    echo "  1. Deploy backend first: cd backend && ./deploy.sh"
    echo "  2. Use manual mode: ./run-local-manual.sh <API_URL>"
    echo "  3. Check your AWS region is correct in backend/.env"
    exit 1
fi

echo "✅ API URL: $API_URL"
echo ""

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Update config
echo "📝 Updating configuration..."
cat > src/config.ts << EOF
// Auto-generated configuration for local development
export const API_URL = '${API_URL}';

export const config = {
  apiUrl: API_URL,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFormats: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
  ],
};
EOF

echo ""
echo "✅ Configuration updated!"
echo ""
echo "🚀 Starting development server..."
echo "   Frontend: http://localhost:3000"
echo "   Backend:  ${API_URL}"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
