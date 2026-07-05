# DOCX to PDF Conversion Required

## Problem Summary

The user asked: "aren't we able to process the word documents?"

**Answer: No, not currently. AWS Textract does NOT support DOCX files.**

## Current Situation

1. **DocumentProcessor validates DOCX format** but cannot process it
2. **AWS Textract only supports**: PDF, PNG, JPG, TIFF
3. **Available test files**:
   - `Grade 11 -Mid year exam Jan.2026-questions.docx` ❌ Cannot process
   - `Grade 11 -Mid year exam Jan.2026-questions.pdf` ❌ Textract rejects (UnsupportedDocumentException)
   - `Grade 11 -Mid year exam Jan.2026-questions-fixed.pdf` ❌ Textract rejects (UnsupportedDocumentException)
   - `answer1.jpeg` through `answer5.jpeg` ✅ Can process

## Root Cause

The PDF files in the examples folder are being rejected by Textract with `UnsupportedDocumentException`. This could be because:
- The PDFs are password-protected
- The PDFs use unsupported PDF features (certain compression, encryption, or PDF versions)
- The PDFs are corrupted
- The PDFs were converted from DOCX in a way that Textract doesn't like

## Solutions

### Option 1: Add DOCX-to-PDF Conversion (Recommended for Production)

Add a conversion step in the DocumentProcessor to convert DOCX files to PDF before sending to Textract.

**Implementation approaches:**

#### A. Using LibreOffice (Server-side)
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function convertDocxToPdf(docxPath: string, pdfPath: string): Promise<void> {
  await execAsync(`libreoffice --headless --convert-to pdf --outdir ${path.dirname(pdfPath)} ${docxPath}`);
}
```

**Pros:**
- Free and open source
- High quality conversion
- Supports many formats

**Cons:**
- Requires LibreOffice installed on Lambda (need custom layer)
- Larger deployment package
- Slower conversion

#### B. Using pdf-lib + mammoth (Node.js libraries)
```typescript
import mammoth from 'mammoth';
import { PDFDocument, rgb } from 'pdf-lib';

async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  // Extract text from DOCX
  const result = await mammoth.extractRawText({ buffer: docxBuffer });
  
  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.drawText(result.value, { x: 50, y: 750, size: 12, color: rgb(0, 0, 0) });
  
  return Buffer.from(await pdfDoc.save());
}
```

**Pros:**
- Pure Node.js, no external dependencies
- Fast conversion
- Easy to deploy

**Cons:**
- Loses formatting (images, tables, styles)
- May not preserve layout
- Text-only conversion

#### C. Using AWS Lambda with LibreOffice Layer
Use a pre-built Lambda layer with LibreOffice:
- https://github.com/shelfio/libreoffice-lambda-layer

**Pros:**
- Production-ready
- Maintained by community
- Good documentation

**Cons:**
- Adds complexity to deployment
- Increases cold start time

### Option 2: Manual PDF Conversion (Quick Fix)

Convert the DOCX files to PDF manually using:
- Microsoft Word: File → Save As → PDF
- Google Docs: File → Download → PDF
- LibreOffice: File → Export as PDF

Then use the converted PDFs for testing.

### Option 3: Fix the Existing PDFs

The existing PDFs are being rejected by Textract. Try:
1. Open the PDF in Preview/Acrobat
2. Export/Save As a new PDF
3. Ensure no password protection
4. Use PDF/A format for better compatibility

### Option 4: Use Answer Sheets Only (Current Workaround)

Since the answer sheet images (JPEG) work fine, we can:
1. Create the exam manually (already done in `create-test-exam-manual.ts`)
2. Test only the answer sheet processing and grading
3. This validates the core functionality without document extraction

## Recommendation

For immediate testing: **Use Option 4** (answer sheets only with manually created exam)

For production: **Implement Option 1C** (LibreOffice Lambda layer) to support DOCX files

## Next Steps

1. ✅ Document the DOCX limitation
2. ⏳ Test answer sheets with manually created exam
3. ⏳ Decide on DOCX conversion approach
4. ⏳ Implement chosen solution

## Test Results

### PDF Direct Test
- Tested with AnalyzeDocument (TABLES, FORMS, TABLES+FORMS)
- All failed with `UnsupportedDocumentException`
- HTTP 400 error from Textract

### DetectDocumentText Test
- Simpler API, still failed
- Same `UnsupportedDocumentException`
- Confirms the PDF itself is the problem, not the API call

## Files Created for Testing

1. `backend/test-real-exam-complete.ts` - Full workflow test (blocked by PDF issue)
2. `backend/test-pdf-direct.ts` - Direct Textract test
3. `backend/test-pdf-detect-text.ts` - Simpler Textract API test
4. `backend/test-answer-sheets-only.ts` - Answer sheets only (ready to use)

## Conclusion

**To answer the user's question**: We cannot currently process Word documents because:
1. AWS Textract doesn't support DOCX format
2. The PDF versions in the examples folder are rejected by Textract
3. We need to either:
   - Add DOCX-to-PDF conversion capability
   - Fix/recreate the PDF files
   - Use the answer sheet images with a manually created exam

The best path forward is to test with answer sheets only (Option 4) while planning to add DOCX conversion for production (Option 1C).
