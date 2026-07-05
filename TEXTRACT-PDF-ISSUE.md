# Textract PDF Compatibility Issue

## Problem

AWS Textract is rejecting the PDF files with error:
```
UnsupportedDocumentException: Request has unsupported document format
```

## Possible Causes

1. **PDF is encrypted or password-protected**
2. **PDF uses unsupported PDF version or features**
3. **PDF was created with certain tools that Textract doesn't support**
4. **PDF contains only images without embedded text (scanned document)**

## Solutions

### Option 1: Re-export PDF (Recommended)

Try re-exporting the PDF with different settings:

**From Microsoft Word:**
1. Open the DOCX file
2. File → Save As → PDF
3. In PDF options, ensure:
   - "Optimize for: Standard" (not Minimum size)
   - "PDF/A compliant" is UNCHECKED
   - No password protection

**From Pages (Mac):**
1. Open the DOCX file
2. File → Export To → PDF
3. Use default settings
4. Ensure no password protection

**From Google Docs:**
1. Upload DOCX to Google Drive
2. Open with Google Docs
3. File → Download → PDF Document

### Option 2: Use Ghostscript to Fix PDF

Install Ghostscript and re-process the PDF:

```bash
# Install Ghostscript
brew install ghostscript

# Fix the PDF
cd backend
./fix-pdf-for-textract.sh "examples/Grade 11 -Mid year exam Jan.2026-questions.pdf"
./fix-pdf-for-textract.sh "examples/Grade 11 mid-year Exam Jan. 2026 Answer Key-questions-with-expected-answers.pdf"
```

This will create `-fixed.pdf` versions that should work with Textract.

### Option 3: Use Online PDF Converter

Use an online tool to convert/fix the PDF:
1. Go to https://www.ilovepdf.com/repair-pdf
2. Upload your PDF
3. Download the repaired version
4. Try again

### Option 4: Convert to Images First

If the PDF is actually a scanned document (images), convert each page to JPEG:

```bash
# Using ImageMagick (if installed)
convert -density 300 "input.pdf" "output-%d.jpg"
```

Then use the JPEG files directly with Textract (which we know works with your student answers).

## Testing

After fixing the PDF, test with:

```bash
cd backend

# Update the KEY in test-textract-direct.ts to point to your new file
# Then run:
npx tsx test-textract-direct.ts
```

## AWS Textract Supported Formats

According to AWS documentation, Textract supports:
- PDF (up to PDF 1.7)
- PNG
- JPEG
- TIFF

**PDF Requirements:**
- Not encrypted
- Not password-protected
- PDF version 1.7 or earlier
- Maximum 3000 pages
- Maximum 10 MB for synchronous API

## Next Steps

1. Try re-exporting the PDF from Word/Pages with standard settings
2. If that doesn't work, install Ghostscript and use the fix script
3. If still failing, convert to images and process as images
4. As a last resort, manually type the questions into the UI

## Alternative: Use UI to Manually Enter Questions

If PDF processing continues to fail, you can:
1. Create the exam through the UI
2. Manually enter the questions
3. Test the grading workflow with student submissions (which are JPEG and work fine)
