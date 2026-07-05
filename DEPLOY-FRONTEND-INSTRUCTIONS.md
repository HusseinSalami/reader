# Deploy Frontend with Table/JSON Toggle

## Issue
The toggle button isn't visible because the frontend needs to be rebuilt and redeployed.

## Status
✅ Frontend code updated with toggle feature
✅ Frontend built successfully (dist/ folder created)
⏳ Needs deployment to S3/CloudFront

## Quick Deploy Steps

### 1. Refresh AWS Credentials
Your AWS credentials have expired. Refresh them first.

### 2. Get Stack Outputs
```bash
cd backend
aws cloudformation describe-stacks \
  --stack-name DocumentPlatformStack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table
```

Look for:
- `FrontendBucketName` - S3 bucket for frontend
- `CloudFrontDistributionId` - CloudFront distribution ID
- `CloudFrontURL` - Your app URL

### 3. Deploy Frontend
```bash
cd frontend

# Upload to S3
aws s3 sync dist/ s3://YOUR-BUCKET-NAME/ --delete --region us-east-1

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR-DIST-ID \
  --paths '/*' \
  --region us-east-1
```

### 4. Test the Toggle
1. Open your CloudFront URL
2. Navigate to a document with array fields (like line_items)
3. You should now see:
   - A purple toggle button above the data
   - Button shows "JSON" when in table view
   - Button shows "Table" when in JSON view
   - Export CSV button only in table view

## What Was Changed

### DocumentDetail.tsx
- Added `fieldViewMode` state to track view per field
- Added `toggleFieldViewMode()` function
- Added `getFieldViewMode()` helper
- Added toggle button with Table/FileJson icons
- Conditional rendering: table view or JSON view
- Export CSV only shown in table view

### Templates_new.tsx
- Fixed syntax errors (missing closing tags)
- Commented out incomplete/unused code

## Alternative: One-Line Deploy Script

Create a file `deploy-frontend-quick.sh`:
```bash
#!/bin/bash
cd frontend
BUCKET=$(aws cloudformation describe-stacks --stack-name DocumentPlatformStack --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' --output text)
DIST_ID=$(aws cloudformation describe-stacks --stack-name DocumentPlatformStack --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' --output text)

echo "Deploying to bucket: $BUCKET"
aws s3 sync dist/ s3://$BUCKET/ --delete --region us-east-1

echo "Invalidating CloudFront: $DIST_ID"
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths '/*' --region us-east-1

echo "✅ Frontend deployed!"
```

Then run:
```bash
chmod +x deploy-frontend-quick.sh
./deploy-frontend-quick.sh
```

## Troubleshooting

### Toggle Still Not Visible
1. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Clear browser cache
3. Check browser console for errors
4. Verify CloudFront invalidation completed:
   ```bash
   aws cloudfront list-invalidations --distribution-id YOUR-DIST-ID --region us-east-1
   ```

### Build Errors
If you need to rebuild:
```bash
cd frontend
npm run build
```

All TypeScript errors have been fixed.
