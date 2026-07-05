#!/bin/bash

# Run frontend locally with manual API URL configuration
# Use this if automatic detection fails

echo "🖥️  Document Reader - Local Development (Manual Config)"
echo "========================================================="
echo ""

# Check if API URL is provided as argument
if [ -z "$1" ]; then
    echo "Usage: ./run-local-manual.sh <API_URL>"
    echo ""
    echo "Example:"
    echo "  ./run-local-manual.sh https://abc123.execute-api.us-east-1.amazonaws.com/prod/"
    echo ""
    echo "To find your API URL:"
    echo "  1. Go to AWS Console > API Gateway"
    echo "  2. Find 'Document Reader Service'"
    echo "  3. Copy the Invoke URL"
    echo ""
    exit 1
fi

API_URL="$1"

echo "✅ Using API URL: $API_URL"
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
// Manual configuration for local development
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
