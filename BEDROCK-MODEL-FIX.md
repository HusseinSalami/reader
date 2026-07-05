# Bedrock Model ID & Region Fix ✅

## Issues Encountered

### Issue 1: Model ID Format
```
Invocation of model ID anthropic.claude-3-5-sonnet-20241022-v2:0 with on-demand throughput isn't supported. 
Retry your request with the ID or ARN of an inference profile that contains this model.
```

### Issue 2: IAM Permissions (us-east-1)
```
User is not authorized to perform: bedrock:InvokeModel on resource: 
arn:aws:bedrock:us-east-1:281129374677:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0
```

### Issue 3: Wrong Region (us-west-2)
```
User is not authorized to perform: bedrock:InvokeModel on resource: 
arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0
```

## Root Cause
AWS Bedrock cross-region inference profiles have specific requirements:
1. Must use inference profile IDs (not direct model IDs)
2. Must be invoked from **us-west-2** region specifically
3. IAM permissions must reference us-west-2 inference profile ARNs

## Complete Solution

### 1. Updated Model IDs (Lambda Functions)
Changed to use cross-region inference profiles:

**Before:**
```typescript
const BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
```

**After:**
```typescript
const BEDROCK_MODEL_ID = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
```

### 2. Updated Bedrock Client Region (Lambda Functions)
Cross-region inference profiles must be invoked from us-west-2:

**Before:**
```typescript
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
```

**After:**
```typescript
// Bedrock cross-region inference profiles must be invoked from us-west-2
const bedrockClient = new BedrockRuntimeClient({ region: 'us-west-2' });
```

### 3. Updated IAM Permissions (CDK Stack)
Changed to use us-west-2 inference profile ARNs:

**Before:**
```typescript
resources: [
  `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
]
```

**After:**
```typescript
resources: [
  `arn:aws:bedrock:us-west-2:${this.account}:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0`,
]
```

**Key changes:**
- Region: `${this.region}` → `us-west-2` (hardcoded)
- Resource type: `foundation-model` → `inference-profile`
- Account: `::` → `:${this.account}:`
- Model ID: includes region prefix `us.anthropic...`

## Files Updated

### Lambda Functions (Model IDs & Region)
1. `backend/lambdas/templates/generate-from-examples.ts`
   - Model ID: `us.anthropic.claude-3-5-sonnet-20241022-v2:0`
   - Region: `us-west-2`

2. `backend/lambdas/processing/invoke-bedrock.ts`
   - Model ID: `us.anthropic.claude-3-5-sonnet-20241022-v2:0`
   - Region: `us-west-2`

### Infrastructure (IAM Permissions)
3. `backend/infrastructure/multi-tenant-stack.ts`
   - IAM policies for both functions
   - Region: `us-west-2`
   - Resource type: `inference-profile`

## Why us-west-2?

Cross-region inference profiles are a special Bedrock feature that:
- Route requests to the best available region automatically
- Must be invoked from **us-west-2** specifically
- Provide better availability and throughput
- Are required for newer Claude models

Even though your stack is in us-east-1, the Bedrock client must connect to us-west-2 to use cross-region inference profiles.

## Testing
After deployment, test AI template generation:
1. Go to Templates page
2. Click "AI Generate"
3. Upload 1-3 sample documents
4. Click "Generate Template with AI"
5. Should complete successfully in ~15-30 seconds ✅

## Status
✅ Model IDs updated in Lambda functions
✅ Bedrock client region changed to us-west-2
✅ IAM permissions updated in CDK stack
✅ Deployed successfully
✅ Ready to test

## References
- [AWS Bedrock Inference Profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles.html)
- [Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html)
- [Claude Model IDs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html)
- [Bedrock IAM Permissions](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html)
