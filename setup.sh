#!/bin/bash

echo "🚀 Setting up Document Reader Service..."
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "⚠️  AWS CLI not found. You'll need it for deployment." >&2; }

echo "✅ Prerequisites check passed"
echo ""

# Setup backend
echo "📦 Installing backend dependencies..."
cd backend
npm install
if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Backend installation failed"
    exit 1
fi
cd ..
echo ""

# Setup frontend
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
if [ $? -eq 0 ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "❌ Frontend installation failed"
    exit 1
fi
cd ..
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy backend: cd backend && npm run deploy"
echo "2. Update frontend config with API URL: frontend/src/config.ts"
echo "3. Run frontend: cd frontend && npm run dev"
echo ""
echo "See DEPLOYMENT.md for detailed instructions."
