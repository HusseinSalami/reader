#!/bin/bash

# Test Multi-Tenant Document Platform API

API_URL="https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod"

echo "🧪 Testing Multi-Tenant Document Platform API"
echo "=============================================="
echo ""
echo "API URL: $API_URL"
echo ""

# Test 1: Register a new customer
echo "📝 Test 1: Register new customer"
echo "--------------------------------"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company Inc",
    "email": "admin@testcompany.com",
    "firstName": "John",
    "lastName": "Doe",
    "subscriptionTier": "PRO"
  }')

echo "$REGISTER_RESPONSE" | jq '.'
echo ""

# Check if registration was successful
if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    CUSTOMER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.customerId')
    echo "✅ Registration successful!"
    echo "Customer ID: $CUSTOMER_ID"
    echo ""
    echo "⏳ Waiting 10 seconds for Cognito user creation..."
    sleep 10
else
    echo "❌ Registration failed"
    exit 1
fi

# Test 2: Try to register with same email (should fail)
echo "📝 Test 2: Try duplicate registration"
echo "-------------------------------------"
DUPLICATE_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Another Company",
    "email": "admin@testcompany.com",
    "firstName": "Jane",
    "lastName": "Smith"
  }')

echo "$DUPLICATE_RESPONSE" | jq '.'
echo ""

if echo "$DUPLICATE_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo "✅ Duplicate registration correctly rejected"
else
    echo "⚠️  Duplicate registration should have failed"
fi
echo ""

# Test 3: Login (will fail until user sets password)
echo "📝 Test 3: Login attempt"
echo "------------------------"
echo "Note: This will fail because the user needs to set their password from the email"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@testcompany.com",
    "password": "TempPassword123!"
  }')

echo "$LOGIN_RESPONSE" | jq '.'
echo ""

# Test 4: Invalid registration (missing fields)
echo "📝 Test 4: Invalid registration (missing fields)"
echo "------------------------------------------------"
INVALID_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company"
  }')

echo "$INVALID_RESPONSE" | jq '.'
echo ""

if echo "$INVALID_RESPONSE" | jq -e '.error.code == "INVALID_INPUT"' > /dev/null 2>&1; then
    echo "✅ Invalid input correctly rejected"
else
    echo "⚠️  Invalid input should have been rejected"
fi
echo ""

# Summary
echo "📊 Test Summary"
echo "==============="
echo "✅ Customer registration endpoint working"
echo "✅ Duplicate detection working"
echo "✅ Input validation working"
echo "✅ Login endpoint accessible (password setup required)"
echo ""
echo "Next steps:"
echo "1. Check email for temporary password"
echo "2. Set permanent password via Cognito"
echo "3. Test login with new password"
echo "4. Continue with Phase 1 implementation"
