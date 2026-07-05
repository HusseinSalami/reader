# Debugging Question Extraction Issues

## Common Issues and Solutions

### 1. Question Numbering Format Not Recognized

The system recognizes these question formats:
- `1. Question text` or `1) Question text`
- `1a. Question text` or `1a) Question text`
- `1.1 Question text` or `1.1. Question text`
- `Q1. Question text` or `Q1) Question text`
- `Question 1: Question text` or `Question 1. Question text`
- `(1) Question text`
- `1- Question text`

**Solution:** Ensure your questions follow one of these formats.

### 2. Poor Image Quality

If using scanned images or photos:
- Ensure text is clear and readable
- Minimum 300 DPI recommended
- Avoid skewed or rotated images
- Ensure good contrast between text and background

**Solution:** Use high-quality scans or PDFs with embedded text.

### 3. Multi-Column Layout

Textract may read columns in unexpected order.

**Solution:** Use single-column layout for questionnaires.

### 4. Questions Split Across Pages

Questions that span multiple pages may not be properly combined.

**Solution:** Keep questions on single pages when possible.

### 5. Special Characters or Formatting

Mathematical symbols, equations, or special formatting may not extract correctly.

**Solution:** Use plain text where possible, or verify extraction and edit manually.

## How to Debug

### Step 1: Check CloudWatch Logs

```bash
# Get the create-exam Lambda function log group
aws logs tail /aws/lambda/DocumentPlatformStack-CreateExamFunction --follow --region us-east-1

# Look for Textract output and parsing results
```

### Step 2: Check the Extracted Text

The system stores the raw Textract output. You can:

1. Check the exam record in DynamoDB
2. Look for the `extractedText` field
3. Compare with your original document

### Step 3: Test with Sample Documents

Create a simple test document:

```
Section 1: Mathematics

1. What is 2 + 2?
2. What is 5 × 3?

Section 2: Science

3. What is H2O?
4. Name the planets in our solar system.
```

### Step 4: Manual Review and Edit

After extraction, you can:
1. Review the extracted questions in Step 2 of the wizard
2. Edit question text directly
3. Add missing questions
4. Remove incorrect extractions
5. Adjust point values

## Checking Logs

### View Create Exam Logs

```bash
# Get recent logs
aws logs tail /aws/lambda/DocumentPlatformStack-CreateExamFunction \
  --since 10m \
  --region us-east-1

# Filter for errors
aws logs tail /aws/lambda/DocumentPlatformStack-CreateExamFunction \
  --since 10m \
  --region us-east-1 \
  --filter-pattern "ERROR"
```

### View Textract Job Details

```bash
# If you have the job ID from logs
aws textract get-document-analysis \
  --job-id YOUR_JOB_ID \
  --region us-east-1
```

## Improving Extraction Accuracy

### 1. Document Preparation

- Use PDF with embedded text (not scanned images)
- Ensure consistent formatting
- Use clear, standard fonts
- Avoid handwritten text in questionnaires
- Use standard question numbering

### 2. Question Format Best Practices

```
Good:
1. What is the capital of France?
2. Explain photosynthesis.
3. Calculate the area of a circle with radius 5cm.

Avoid:
- Questions without numbers
- Inconsistent numbering (1, 2, a, b, 3)
- Questions embedded in paragraphs
- Questions in tables or complex layouts
```

### 3. Section Headers

Use clear section headers:

```
Good:
Section 1: Multiple Choice
Section A: Essay Questions
Part 1: Mathematics

Avoid:
- Sections without clear headers
- Headers that look like questions
- Nested sections
```

## API Response Structure

When you create an exam, the response includes:

```json
{
  "examId": "exam-123",
  "sections": [
    {
      "sectionNumber": 1,
      "sectionTitle": "Mathematics",
      "questions": [
        {
          "questionNumber": "1",
          "questionText": "What is 2 + 2?",
          "points": 5,
          "sectionId": "section-1"
        }
      ]
    }
  ],
  "extractionConfidence": 0.95,
  "totalQuestions": 10
}
```

Check the `extractionConfidence` score:
- **> 0.9:** High confidence, likely accurate
- **0.7 - 0.9:** Medium confidence, review recommended
- **< 0.7:** Low confidence, manual review required

## Manual Correction Workflow

If extraction is incorrect:

1. **In the Wizard (Step 2):**
   - Review extracted questions
   - Edit question text inline
   - Add missing questions with "Add Question" button
   - Remove incorrect extractions
   - Adjust point values

2. **After Creation:**
   - Use the "Update Questions" API endpoint
   - PUT /v1/exams/{examId}/questions
   - Send corrected questions array

## Getting Help

If issues persist:

1. **Check the exam record:**
   ```bash
   aws dynamodb get-item \
     --table-name DocumentPlatform-Exams \
     --key '{"PK":{"S":"CUSTOMER#your-customer-id"},"SK":{"S":"EXAM#exam-id"}}' \
     --region us-east-1
   ```

2. **Check S3 for uploaded document:**
   ```bash
   aws s3 ls s3://document-platform-380018306486-us-east-1/exams/
   ```

3. **Review Textract confidence scores:**
   - Low confidence blocks may indicate poor image quality
   - Check the `Confidence` field in Textract output

## Example: Fixing Common Issues

### Issue: Questions merged together

**Problem:** "1. Question A 2. Question B" extracted as one question

**Cause:** Questions on same line or insufficient spacing

**Solution:** 
- Ensure each question starts on a new line
- Add blank lines between questions
- Or manually split in the wizard

### Issue: Section headers treated as questions

**Problem:** "Section 1: Math" extracted as a question

**Cause:** Section header matches question pattern

**Solution:**
- Use distinct section header format
- Or manually delete in the wizard

### Issue: Multi-line questions truncated

**Problem:** Only first line of question extracted

**Cause:** Parser stops at next question number

**Solution:**
- The parser should handle this automatically
- If not, manually edit to add missing text

## Testing the Fix

After making corrections:

1. Upload a test submission
2. Verify grading works correctly
3. Check that question numbers match
4. Ensure answer key mappings are correct

## Contact Support

If you continue to have issues, provide:
- Sample questionnaire document
- Expected questions
- Actual extracted questions
- CloudWatch log excerpts
- Exam ID for investigation
