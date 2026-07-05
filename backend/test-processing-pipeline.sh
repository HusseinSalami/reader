#!/bin/bash

# Test Processing Pipeline
# This script tests the complete document processing pipeline end-to-end

set -e

echo "🚀 Testing Document Processing Pipeline"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get API URL from CDK outputs or environment
if [ -z "$API_URL" ]; then
    echo -e "${YELLOW}⚠️  API_URL not set. Getting from CDK outputs...${NC}"
    
    # Try to get from CloudFormation stack
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name DocumentPlatformStack \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    # If not found, try to get from cdk.out
    if [ -z "$API_URL" ] || [ "$API_URL" = "None" ]; then
        echo -e "${YELLOW}   Trying cdk.out directory...${NC}"
        if [ -f "cdk.out/DocumentPlatformStack.template.json" ]; then
            # Extract from CDK outputs file if it exists
            API_URL=$(cat cdk.out/outputs.json 2>/dev/null | jq -r '.DocumentPlatformStack.ApiUrl' 2>/dev/null || echo "")
        fi
    fi
    
    if [ -z "$API_URL" ] || [ "$API_URL" = "None" ] || [ "$API_URL" = "null" ]; then
        echo -e "${RED}❌ Could not get API URL automatically.${NC}"
        echo ""
        echo "Please run one of these commands to get your API URL:"
        echo ""
        echo "  1. From CloudFormation:"
        echo "     aws cloudformation describe-stacks --stack-name DocumentPlatformStack \\"
        echo "       --query 'Stacks[0].Outputs[?OutputKey==\`ApiUrl\`].OutputValue' --output text"
        echo ""
        echo "  2. From CDK deploy output (look for 'ApiUrl = ...')"
        echo ""
        echo "Then run this script with:"
        echo "  export API_URL=<your-api-url>"
        echo "  ./test-processing-pipeline.sh"
        echo ""
        exit 1
    fi
    
    echo -e "${GREEN}✅ Found API URL from CDK outputs${NC}"
fi

# Remove trailing slash from API_URL if present
API_URL="${API_URL%/}"

echo -e "${BLUE}📍 API URL: $API_URL${NC}"
echo ""

# Step 1: Register a test user
echo -e "${BLUE}Step 1: Register test user${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test-pipeline@example.com",
        "password": "TestPipeline123!",
        "companyName": "Pipeline Test Co",
        "firstName": "Test",
        "lastName": "User"
    }')

echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"

# Extract customer ID
CUSTOMER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.customerId' 2>/dev/null || echo "")
if [ -z "$CUSTOMER_ID" ] || [ "$CUSTOMER_ID" = "null" ]; then
    echo -e "${YELLOW}⚠️  Registration may have failed (user might already exist). Trying login...${NC}"
fi
echo ""

# Step 2: Login
echo -e "${BLUE}Step 2: Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test-pipeline@example.com",
        "password": "TestPipeline123!"
    }')

echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"

# Extract token and customer ID - Use ID token for authorization (has custom attributes)
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.idToken // .idToken' 2>/dev/null | tr -d '\n' || echo "")
if [ -z "$CUSTOMER_ID" ] || [ "$CUSTOMER_ID" = "null" ]; then
    CUSTOMER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.customerId // .customerId' 2>/dev/null || echo "")
fi

# Try to extract from idToken if customerId not found
if [ -z "$CUSTOMER_ID" ] || [ "$CUSTOMER_ID" = "null" ]; then
    if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        # Decode JWT payload (base64 decode the middle part)
        CUSTOMER_ID=$(echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '."custom:customerId"' 2>/dev/null || echo "")
    fi
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}❌ Login failed. Cannot proceed.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Logged in successfully${NC}"
echo -e "${BLUE}   Customer ID: $CUSTOMER_ID${NC}"
echo ""

# Step 3: Create a document type
echo -e "${BLUE}Step 3: Create document type${NC}"
DOCTYPE_RESPONSE=$(curl -s -X POST "$API_URL/v1/document-types" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Invoice",
        "description": "Standard invoice document",
        "schema": {
            "fields": [
                {
                    "fieldId": "invoice_number",
                    "name": "invoice_number",
                    "dataType": "text",
                    "required": true,
                    "validationRules": [
                        {
                            "type": "required",
                            "params": {}
                        }
                    ]
                },
                {
                    "fieldId": "total_amount",
                    "name": "total_amount",
                    "dataType": "number",
                    "required": true,
                    "validationRules": [
                        {
                            "type": "required",
                            "params": {}
                        }
                    ]
                },
                {
                    "fieldId": "invoice_date",
                    "name": "invoice_date",
                    "dataType": "date",
                    "required": true,
                    "validationRules": [
                        {
                            "type": "required",
                            "params": {}
                        },
                        {
                            "type": "dateFormat",
                            "params": {
                                "format": "YYYY-MM-DD"
                            }
                        }
                    ]
                }
            ]
        }
    }')

echo "$DOCTYPE_RESPONSE" | jq '.' 2>/dev/null || echo "$DOCTYPE_RESPONSE"

DOCTYPE_ID=$(echo "$DOCTYPE_RESPONSE" | jq -r '.data.documentTypeId // .documentTypeId' 2>/dev/null || echo "")

# If creation failed due to duplicate, try to list and use existing
if [ -z "$DOCTYPE_ID" ] || [ "$DOCTYPE_ID" = "null" ]; then
    ERROR_CODE=$(echo "$DOCTYPE_RESPONSE" | jq -r '.error.code' 2>/dev/null || echo "")
    if [ "$ERROR_CODE" = "DUPLICATE_NAME" ]; then
        echo -e "${YELLOW}⚠️  Document type already exists. Fetching existing...${NC}"
        
        # Save token to temp file to avoid shell expansion issues
        echo "$TOKEN" > /tmp/test_token.txt
        
        # List document types and get the first one
        LIST_RESPONSE=$(curl -s -X GET "$API_URL/v1/document-types" \
            -H "Authorization: Bearer $(cat /tmp/test_token.txt)")
        
        # Debug: Check if we got a valid response
        if echo "$LIST_RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
            DOCTYPE_ID=$(echo "$LIST_RESPONSE" | jq -r '.data.items[0].documentTypeId' 2>/dev/null || echo "")
        else
            echo -e "${YELLOW}   List response: $LIST_RESPONSE${NC}"
            DOCTYPE_ID=""
        fi
        
        if [ -z "$DOCTYPE_ID" ] || [ "$DOCTYPE_ID" = "null" ]; then
            echo -e "${RED}❌ Failed to get existing document type${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ Using existing document type: $DOCTYPE_ID${NC}"
    else
        echo -e "${RED}❌ Failed to create document type${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Document type created: $DOCTYPE_ID${NC}"
fi
echo ""

# Step 4: Create a template
echo -e "${BLUE}Step 4: Create template${NC}"

# Save token to temp file to avoid shell expansion issues
echo "$TOKEN" > /tmp/test_token.txt

TEMPLATE_RESPONSE=$(curl -s -X POST "$API_URL/v1/templates" \
    -H "Authorization: Bearer $(cat /tmp/test_token.txt)" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Standard Invoice Template\",
        \"description\": \"Template for extracting invoice data\",
        \"documentTypeId\": \"$DOCTYPE_ID\",
        \"rules\": [
            {
                \"fieldId\": \"invoice_number\",
                \"method\": \"textract_kv\",
                \"params\": {
                    \"keyPattern\": \"invoice number\",
                    \"confidence\": 0.8
                }
            },
            {
                \"fieldId\": \"total_amount\",
                \"method\": \"textract_kv\",
                \"params\": {
                    \"keyPattern\": \"total\",
                    \"confidence\": 0.8
                }
            },
            {
                \"fieldId\": \"invoice_date\",
                \"method\": \"regex\",
                \"params\": {
                    \"pattern\": \"\\\\d{4}-\\\\d{2}-\\\\d{2}\",
                    \"captureGroup\": 0
                }
            }
        ]
    }")

echo "$TEMPLATE_RESPONSE" | jq '.' 2>/dev/null || echo "$TEMPLATE_RESPONSE"

TEMPLATE_ID=$(echo "$TEMPLATE_RESPONSE" | jq -r '.data.templateId // .templateId' 2>/dev/null || echo "")
if [ -z "$TEMPLATE_ID" ] || [ "$TEMPLATE_ID" = "null" ]; then
    echo -e "${RED}❌ Failed to create template${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Template created: $TEMPLATE_ID${NC}"
echo ""

# Step 5: Create a test PDF (simple text-based PDF)
echo -e "${BLUE}Step 5: Create test document${NC}"
TEST_FILE="test-invoice.pdf"

# Create a simple PDF using printf and PostScript
# This creates a minimal valid PDF that Textract can process
cat > "$TEST_FILE" << 'PDFEOF'
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 350
>>
stream
BT
/F1 24 Tf
50 750 Td
(INVOICE) Tj
0 -30 Td
/F1 12 Tf
(Invoice Number: INV-2024-001) Tj
0 -20 Td
(Invoice Date: 2024-01-15) Tj
0 -40 Td
(Bill To:) Tj
0 -20 Td
(Test Company Inc.) Tj
0 -20 Td
(123 Main Street) Tj
0 -40 Td
(Items:) Tj
0 -20 Td
(Product A: $100.00) Tj
0 -20 Td
(Product B: $50.00) Tj
0 -40 Td
(Total: $192.50) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000317 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
717
%%EOF
PDFEOF

echo -e "${GREEN}✅ Test document created: $TEST_FILE${NC}"
echo ""

# Step 6: Upload document
echo -e "${BLUE}Step 6: Upload document${NC}"

# Convert file to base64 (macOS compatible)
if [[ "$OSTYPE" == "darwin"* ]]; then
    FILE_CONTENT=$(base64 -i "$TEST_FILE" | tr -d '\n')
else
    FILE_CONTENT=$(base64 "$TEST_FILE" | tr -d '\n')
fi

UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/v1/documents/upload-new" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"documentTypeId\": \"$DOCTYPE_ID\",
        \"templateId\": \"$TEMPLATE_ID\",
        \"filename\": \"test-invoice.pdf\",
        \"fileContent\": \"$FILE_CONTENT\",
        \"language\": \"en\"
    }")

echo "$UPLOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$UPLOAD_RESPONSE"

DOCUMENT_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.documentId // .documentId' 2>/dev/null || echo "")
if [ -z "$DOCUMENT_ID" ] || [ "$DOCUMENT_ID" = "null" ]; then
    echo -e "${RED}❌ Failed to upload document${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Document uploaded: $DOCUMENT_ID${NC}"
echo ""

# Step 7: Monitor processing
echo -e "${BLUE}Step 7: Monitor document processing${NC}"
echo -e "${YELLOW}⏳ Waiting for processing to complete (this may take 30-60 seconds)...${NC}"
echo ""

MAX_ATTEMPTS=20
ATTEMPT=0
STATUS="processing"

while [ "$STATUS" = "processing" ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 5
    ATTEMPT=$((ATTEMPT + 1))
    
    DOC_RESPONSE=$(curl -s -X GET "$API_URL/v1/documents/$DOCUMENT_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    STATUS=$(echo "$DOC_RESPONSE" | jq -r '.data.status // .status' 2>/dev/null || echo "unknown")
    
    echo -e "${BLUE}   Attempt $ATTEMPT/$MAX_ATTEMPTS - Status: $STATUS${NC}"
    
    if [ "$STATUS" = "completed" ]; then
        echo ""
        echo -e "${GREEN}✅ Processing completed!${NC}"
        echo ""
        echo -e "${BLUE}📄 Document Details:${NC}"
        echo "$DOC_RESPONSE" | jq '.' 2>/dev/null || echo "$DOC_RESPONSE"
        echo ""
        
        # Check for extracted data
        EXTRACTED_DATA=$(echo "$DOC_RESPONSE" | jq '.extractedData' 2>/dev/null || echo "")
        if [ ! -z "$EXTRACTED_DATA" ] && [ "$EXTRACTED_DATA" != "null" ]; then
            echo -e "${GREEN}✅ Extracted Data:${NC}"
            echo "$EXTRACTED_DATA" | jq '.' 2>/dev/null || echo "$EXTRACTED_DATA"
        fi
        
        # Check for validation errors
        VALIDATION_ERRORS=$(echo "$DOC_RESPONSE" | jq '.validationErrors' 2>/dev/null || echo "")
        if [ ! -z "$VALIDATION_ERRORS" ] && [ "$VALIDATION_ERRORS" != "null" ] && [ "$VALIDATION_ERRORS" != "[]" ]; then
            echo -e "${YELLOW}⚠️  Validation Errors:${NC}"
            echo "$VALIDATION_ERRORS" | jq '.' 2>/dev/null || echo "$VALIDATION_ERRORS"
        fi
        
        break
    elif [ "$STATUS" = "failed" ]; then
        echo ""
        echo -e "${RED}❌ Processing failed${NC}"
        echo "$DOC_RESPONSE" | jq '.' 2>/dev/null || echo "$DOC_RESPONSE"
        exit 1
    fi
done

if [ "$STATUS" = "processing" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Processing is taking longer than expected${NC}"
    echo -e "${BLUE}   Check Step Functions console for execution status${NC}"
    echo -e "${BLUE}   Document ID: $DOCUMENT_ID${NC}"
fi

# Cleanup
rm -f "$TEST_FILE"

echo ""
echo -e "${BLUE}Step 8: Cleanup test data${NC}"

# Delete document
if [ ! -z "$DOCUMENT_ID" ] && [ "$DOCUMENT_ID" != "null" ]; then
    echo -e "${BLUE}   Deleting document...${NC}"
    DELETE_DOC_RESPONSE=$(curl -s -X DELETE "$API_URL/v1/documents/$DOCUMENT_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$DELETE_DOC_RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Document deleted${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Could not delete document (may not exist or already deleted)${NC}"
    fi
fi

# Delete template
if [ ! -z "$TEMPLATE_ID" ] && [ "$TEMPLATE_ID" != "null" ]; then
    echo -e "${BLUE}   Deleting template...${NC}"
    DELETE_TEMPLATE_RESPONSE=$(curl -s -X DELETE "$API_URL/v1/templates/$TEMPLATE_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$DELETE_TEMPLATE_RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Template deleted${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Could not delete template (may not exist or already deleted)${NC}"
    fi
fi

# Delete document type
if [ ! -z "$DOCTYPE_ID" ] && [ "$DOCTYPE_ID" != "null" ]; then
    echo -e "${BLUE}   Deleting document type...${NC}"
    DELETE_DOCTYPE_RESPONSE=$(curl -s -X DELETE "$API_URL/v1/document-types/$DOCTYPE_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$DELETE_DOCTYPE_RESPONSE" | jq -e '.success == true' >/dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Document type deleted${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Could not delete document type (may not exist or already deleted)${NC}"
    fi
fi

echo -e "${GREEN}✅ Cleanup complete${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Pipeline test complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo -e "  Customer ID: $CUSTOMER_ID"
echo -e "  Document Type ID: $DOCTYPE_ID"
echo -e "  Template ID: $TEMPLATE_ID"
echo -e "  Document ID: $DOCUMENT_ID"
echo -e "  Final Status: $STATUS"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Check Step Functions console for execution details"
echo "  2. Check CloudWatch logs for Lambda function outputs"
echo "  3. Verify extracted data matches expected values"
echo ""
