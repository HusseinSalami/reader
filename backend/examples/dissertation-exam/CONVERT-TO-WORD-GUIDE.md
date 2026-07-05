# Converting Text Files to Word Documents

I've created plain text versions of the exam files that you can easily convert to Word (.docx) format for uploading through the UI.

## Files Created

1. **FOR-WORD-questionnaire.txt** - The exam questionnaire
2. **FOR-WORD-answer-key.txt** - The answer key with expected answers

## How to Convert to Word

### Option 1: Copy and Paste (Easiest)

1. Open `FOR-WORD-questionnaire.txt` in any text editor
2. Select all (Cmd+A on Mac, Ctrl+A on Windows)
3. Copy (Cmd+C or Ctrl+C)
4. Open Microsoft Word
5. Create a new document
6. Paste (Cmd+V or Ctrl+V)
7. Save as `dissertation-questionnaire.docx`
8. Repeat for `FOR-WORD-answer-key.txt` → `dissertation-answer-key.docx`

### Option 2: Open Directly in Word

1. Open Microsoft Word
2. File → Open
3. Select `FOR-WORD-questionnaire.txt`
4. Word will open it as a text file
5. File → Save As → Choose "Word Document (.docx)"
6. Save as `dissertation-questionnaire.docx`
7. Repeat for answer key

### Option 3: Use Command Line (Mac/Linux)

If you have `textutil` (Mac) or `pandoc` installed:

```bash
# Mac (using textutil)
textutil -convert docx FOR-WORD-questionnaire.txt -output dissertation-questionnaire.docx
textutil -convert docx FOR-WORD-answer-key.txt -output dissertation-answer-key.docx

# With pandoc (Mac/Linux/Windows)
pandoc FOR-WORD-questionnaire.txt -o dissertation-questionnaire.docx
pandoc FOR-WORD-answer-key.txt -o dissertation-answer-key.docx
```

## For Student Submissions

The student answer files are already in markdown format. You can convert them the same way:

1. `student-answer-sample-1.md` → `student-1-ahmed-hassan.docx`
2. `student-answer-sample-2.md` → `student-2-fatima-ali.docx`
3. `student-answer-sample-3.md` → `student-3-omar-ibrahim.docx`

## What the System Supports

Your document processor supports these formats:
- ✅ PDF (.pdf)
- ✅ Word (.docx)
- ✅ PNG (.png)
- ✅ JPG (.jpg)

## Recommended Format

**Use .docx (Word) format** because:
- Easy to create and edit
- Widely supported
- Good for text-heavy documents
- AWS Textract handles it well
- Teachers are familiar with it

## File Naming Suggestions

For clarity when uploading:

**Questionnaire:**
- `Grade-11-Literature-Exam-Questions.docx`
- `Dissertation-Exam-Questionnaire.docx`

**Answer Key:**
- `Grade-11-Literature-Exam-Answer-Key.docx`
- `Dissertation-Exam-Expected-Answers.docx`

**Student Submissions:**
- `Ahmed-Hassan-2026-1145.docx`
- `Fatima-Ali-2026-1089.docx`
- `Omar-Ibrahim-2026-1203.docx`

## Testing in UI

Once you have the Word files:

1. **Create Exam:**
   - Go to "Create Exam" in UI
   - Upload `dissertation-questionnaire.docx`
   - Upload `dissertation-answer-key.docx`
   - Fill in exam details
   - Submit

2. **Upload Submissions:**
   - Go to the exam you created
   - Click "Upload Submissions"
   - Upload each student's .docx file
   - Fill in student info
   - Submit

3. **Wait for Grading:**
   - System will process documents
   - Extract text with Textract
   - Grade with AI (Bedrock Claude)
   - Show results

4. **View Results:**
   - Check grading results
   - Review confidence scores
   - Manually review if needed

## Expected Results

Based on our unit test, you should see:
- **Fatima Ali**: ~98% (49/50 points)
- **Omar Ibrahim**: ~96% (48/50 points)
- **Ahmed Hassan**: ~90% (45/50 points)

All with high confidence scores (90-100%).

## Troubleshooting

### If Upload Fails
- Check file size (should be under 10MB)
- Verify file format is .docx
- Try re-saving in Word
- Check file isn't corrupted

### If Extraction Fails
- Ensure text is selectable (not an image)
- Check document isn't password protected
- Verify formatting isn't too complex
- Try simpler formatting

### If Grading Seems Wrong
- Check CloudWatch logs
- Verify Bedrock is enabled
- Check confidence scores
- Use manual review feature

## Quick Start Commands

If you have pandoc installed:

```bash
cd backend/examples/dissertation-exam

# Convert to Word
pandoc FOR-WORD-questionnaire.txt -o dissertation-questionnaire.docx
pandoc FOR-WORD-answer-key.txt -o dissertation-answer-key.docx
pandoc student-answer-sample-1.md -o student-ahmed-hassan.docx
pandoc student-answer-sample-2.md -o student-fatima-ali.docx
pandoc student-answer-sample-3.md -o student-omar-ibrahim.docx

echo "✅ Word documents created!"
echo "Ready to upload through UI"
```

## Next Steps

1. Convert text files to Word (.docx)
2. Open your UI (frontend)
3. Navigate to "Create Exam"
4. Upload the questionnaire and answer key
5. Upload student submissions
6. Watch the magic happen! 🎉

The system will:
- Extract questions and answers
- Process student submissions
- Grade with AI
- Show results with confidence scores
- Flag low-confidence answers for review

Good luck with your testing!
