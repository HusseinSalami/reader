#!/bin/bash

# Test Exam Creation with Real Documents
# This script uploads the exam documents to S3 and tests the exam creation API

set -e

echo "🧪 Testing Exam Creation with Real Documents"
echo "=============================================="

# Configuration
REGION="us-east-1"
STACK_NAME="DocumentPlatformStack"
EXAMPLES_DIR="./examples"

# Get stack outputs
echo "📋 Getting stack information..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

echo "  API URL: $API_URL"
echo "  Bucket: $BUCKET_NAME"

# Check if files exist
QUESTIONNAIRE="$EXAMPLES_DIR/Grade 11 -Mid year exam Jan.2026-questions.docx"
ANSWER_KEY="$EXAMPLES_DIR/Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers.docx"

if [ ! -f "$QUESTIONNAIRE" ]; then
  echo "❌ Questionnaire not found: $QUESTIONNAIRE"
  exit 1
fi

if [ ! -f "$ANSWER_KEY" ]; then
  echo "❌ Answer key not found: $ANSWER_KEY"
  exit 1
fi

echo "✓ Found questionnaire and answer key"

# Upload questionnaire to S3
echo ""
echo "📤 Uploading questionnaire to S3..."
QUESTIONNAIRE_KEY="test-exams/questionnaire-$(date +%s).docx"
aws s3 cp "$QUESTIONNAIRE" "s3://$BUCKET_NAME/$QUESTIONNAIRE_KEY" \
  --region $REGION \
  --content-type "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

QUESTIONNAIRE_URL="s3://$BUCKET_NAME/$QUESTIONNAIRE_KEY"
echo "  ✓ Uploaded: $QUESTIONNAIRE_URL"

# Upload answer key to S3
echo ""
echo "📤 Uploading answer key to S3..."
ANSWER_KEY_KEY="test-exams/answer-key-$(date +%s).docx"
aws s3 cp "$ANSWER_KEY" "s3://$BUCKET_NAME/$ANSWER_KEY_KEY" \
  --region $REGION \
  --content-type "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

ANSWER_KEY_URL="s3://$BUCKET_NAME/$ANSWER_KEY_KEY"
echo "  ✓ Uploaded: $ANSWER_KEY_URL"

# Get auth token (you'll need to replace this with actual login)
echo ""
echo "🔐 Getting authentication token..."
echo "⚠️  Note: You need to login first. Using test credentials..."

# For testing, we'll use a mock customer ID
# In production, you'd get this from the JWT token
CUSTOMER_ID="test-customer-$(date +%s)"

# Create exam via API
echo ""
echo "📝 Creating exam via API..."

# Create the request payload
REQUEST_PAYLOAD=$(cat <<EOF
{
  "title": "Grade 11 Mid-Year Exam - January 2026",
  "description": "Integration test with real exam documents",
  "teacherId": "teacher-test",
  "questionnaireUrl": "$QUESTIONNAIRE_URL",
  "answerKeyUrl": "$ANSWER_KEY_URL"
}
EOF
)

echo "Request payload:"
echo "$REQUEST_PAYLOAD" | jq .

# Note: This will fail without proper authentication
# You need to add the Authorization header with a valid JWT token
echo ""
echo "⚠️  To complete this test, you need to:"
echo "   1. Login to get a JWT token"
echo "   2. Add the Authorization header to the curl command below"
echo ""
echo "Example curl command:"
echo "curl -X POST \"${API_URL}v1/exams\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer YOUR_JWT_TOKEN\" \\"
echo "  -d '$REQUEST_PAYLOAD'"

echo ""
echo "✅ Documents uploaded successfully!"
echo "   Questionnaire: $QUESTIONNAIRE_URL"
echo "   Answer Key: $ANSWER_KEY_URL"
echo ""
echo "You can now test exam creation through the UI or API."
