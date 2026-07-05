# Manual Testing Guide - Exam Grading System

## Overview

Since the PDFs are image-based and require async Textract support, we'll test the system manually first. This lets you verify the complete workflow works with your real student submissions.

## Prerequisites

1. ✅ Backend deployed with Textract permissions
2. ✅ Frontend running
3. ✅ Student answer JPEGs ready (answer1.jpeg - answer5.jpeg)

## Step 1: Start the Frontend

```bash
cd frontend
npm run dev
```

The app should open at http://localhost:3000

## Step 2: Login/Register

1. Register a new account or login
2. You'll be redirected to the dashboard

## Step 3: Navigate to Exam Grading

1. Click on "Advanced" in the navigation menu
2. You should see the Exam Grading Dashboard

## Step 4: Create Exam Manually

Since automated extraction isn't working yet, we'll create the exam manually:

### Option A: Use the UI (if it supports manual entry)
1. Click "Create Exam"
2. Enter exam details:
   - Title: "Grade 11 Mid-Year Exam - January 2026"
   - Description: "Manual test exam"
   - Teacher ID: Your user ID

### Option B: Create via API (I'll help you with this)

Let me create a script to create the exam with sample questions from your document.

## Step 5: Upload Student Submissions

Once the exam is created:

1. Click on the exam
2. Click "Upload Submissions"
3. Upload the student answer JPEGs:
   - answer1.jpeg (Student: Alice)
   - answer2.jpeg (Student: Bob)
   - answer3.jpeg (Student: Carol)
   - answer4.jpeg (Student: David)
   - answer5.jpeg (Student: Eve)

## Step 6: View Grading Results

1. Wait for processing to complete (30-60 seconds per submission)
2. View the grading results dashboard
3. Check:
   - Confidence scores
   - AI-assigned grades
   - Explanations

## Step 7: Manual Review

1. Click on submissions with low confidence (<70%)
2. Review the AI grading
3. Approve, modify, or reject grades
4. Add your reasoning for any changes

## Step 8: Export Results

1. Click "Export to CSV" or "Export to Excel"
2. Download and verify the results file

## What to Test

### ✅ Student Submission Processing
- [ ] JPEG upload works
- [ ] Handwriting recognition extracts text
- [ ] Text is readable and accurate

### ✅ AI Grading
- [ ] Grades are assigned
- [ ] Confidence scores are calculated
- [ ] Explanations are provided
- [ ] Partial credit is awarded appropriately

### ✅ Manual Review
- [ ] Can view student vs expected answers
- [ ] Can modify grades
- [ ] Can add reasoning
- [ ] Changes are saved

### ✅ Dashboard
- [ ] Shows all submissions
- [ ] Color coding works (green/yellow/red)
- [ ] Filtering works
- [ ] Sorting works

### ✅ Export
- [ ] CSV export works
- [ ] Excel export works
- [ ] All data is included

## Expected Results

### Student Submissions (JPEGs)
These should work perfectly because:
- ✅ Textract supports JPEG images
- ✅ Handwriting recognition is implemented
- ✅ Your files are already in the right format

### AI Grading
Should work because:
- ✅ Bedrock Claude is configured
- ✅ Grading engine is implemented
- ✅ Semantic comparison logic is ready

### Manual Review
Should work because:
- ✅ UI is implemented
- ✅ Override logic is ready
- ✅ Database schema supports it

## Troubleshooting

### If student submission upload fails:
1. Check file size (should be < 10MB)
2. Verify JPEG format
3. Check CloudWatch logs for errors

### If grading doesn't start:
1. Check SQS queue for messages
2. Verify Lambda has Bedrock permissions
3. Check CloudWatch logs for grade-submission function

### If results don't appear:
1. Refresh the page
2. Check browser console for errors
3. Verify API calls are succeeding

## Next Steps After Manual Testing

Once you verify the system works:

1. **Implement Async Textract Support**
   - Update document processor to use StartDocumentAnalysis
   - Add polling logic for GetDocumentAnalysis
   - Handle multi-page results
   - Test with your image-based PDFs

2. **Add Multi-Page Image Upload**
   - Allow uploading multiple images for questionnaire
   - Combine results from multiple pages
   - Update UI to handle page-by-page upload

3. **Optimize Performance**
   - Add caching for repeated extractions
   - Batch process multiple submissions
   - Add progress indicators

## Questions to Answer During Testing

1. Does handwriting recognition work well with your student's handwriting?
2. Are the AI grades reasonable and well-explained?
3. Is the confidence scoring accurate?
4. Is the manual review interface intuitive?
5. Are there any missing features you need?

## Report Issues

If you encounter any issues, note:
- What you were doing
- What you expected
- What actually happened
- Any error messages
- Screenshots if helpful

I'll help you debug and fix any issues!
