# PDF is Scanned/Image-Based - Solution

## Problem Confirmed

The PDF files are **image-based** (scanned documents), not text-based PDFs. This is why Textract rejects them with "Unsupported document format".

When we check for embedded text in the PDF, there is none - it's just images of pages.

## Why This Happens

When you convert a DOCX to PDF, if the DOCX itself contains images of text (not actual text), or if the conversion process renders the text as images, you get an image-based PDF.

## Solutions

### Option 1: Convert PDF Pages to Images (Recommended)

Since Textract works perfectly with JPEG/PNG images (as proven by your student answer files), we can:

1. **Convert each PDF page to an image**
2. **Upload images to S3**
3. **Process with Textract** (which we know works)

#### Using ImageMagick:
```bash
# Install ImageMagick
brew install imagemagick

# Convert PDF to images (one per page)
cd backend/examples
convert -density 300 "Grade 11 -Mid year exam Jan.2026-questions-fixed.pdf" "questionnaire-page-%d.jpg"
convert -density 300 "Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers-fixed.pdf" "answer-key-page-%d.jpg"
```

This will create:
- `questionnaire-page-0.jpg`
- `questionnaire-page-1.jpg`
- `questionnaire-page-2.jpg`
- etc.

### Option 2: Re-create PDF from Original DOCX

The issue is in how the PDF was created. Try:

1. **Open the original DOCX in Microsoft Word**
2. **Ensure the text is actual text** (not images)
   - Try selecting text with your mouse
   - If you can't select it, it's an image
3. **Export as PDF with these settings:**
   - File → Save As → PDF
   - Quality: Best for printing
   - Optimize for: Standard (not Minimum size)
   - Ensure "Create bookmarks" is checked
   - PDF/A compliant: OFF

### Option 3: Use Textract Asynchronous API

For image-based PDFs, AWS Textract has an asynchronous API that can handle them:
- `StartDocumentAnalysis` instead of `AnalyzeDocument`
- Works with image-based PDFs
- Takes longer (async processing)
- Requires polling for results

We would need to update the code to use this API.

### Option 4: Manual Entry (Temporary Workaround)

For immediate testing:
1. Create the exam through the UI
2. Manually enter the questions
3. Test the grading workflow with student submissions
4. Come back to automated extraction later

## Recommended Immediate Action

**Convert PDF to images and test:**

```bash
cd backend/examples

# Install ImageMagick if needed
brew install imagemagick

# Convert questionnaire
convert -density 300 "Grade 11 -Mid year exam Jan.2026-questions-fixed.pdf" "questionnaire-page-%d.jpg"

# Convert answer key  
convert -density 300 "Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers-fixed.pdf" "answer-key-page-%d.jpg"

# List the created images
ls -lh questionnaire-page-*.jpg answer-key-page-*.jpg
```

Then we can update the code to:
1. Accept multiple images for questionnaire
2. Process each page separately
3. Combine results

## Why Student Answers Work

Your student answer JPEGs work perfectly because they're already in image format. Textract is designed to work with images - it's the PDF wrapper that's causing issues.

## Next Steps

1. Try converting PDF to images
2. Test Textract with one image
3. If it works, update the system to handle multi-page image uploads
4. Alternatively, implement async Textract API for image-based PDFs
