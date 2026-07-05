# AI Grading Lambda Functions

This directory contains Lambda functions for AI-powered grading in the Exam Grading System.

## Planned Functions

- `process-submission.ts` - Extract handwritten text from student submissions using AWS Textract
- `grade-submission.ts` - Grade student answers using Amazon Bedrock (Claude)
- `batch-grade.ts` - Process multiple submissions in parallel

## Processing Pipeline

1. **Handwriting Recognition**: AWS Textract extracts handwritten text from scanned submissions
2. **Spatial Analysis**: Maps extracted text blocks to question numbers using bounding boxes
3. **AI Grading**: Amazon Bedrock Claude semantically compares student answers with answer keys
4. **Confidence Scoring**: Assigns confidence scores (0-100%) to each grading decision
5. **Manual Review Flagging**: Flags low-confidence grades (<70%) for teacher review

## Cost Tracking

All functions track AWS service usage:
- Textract: Page count and cost
- Bedrock: Token count (input/output) and cost

See `backend/lambdas/layers/shared/nodejs/exam-types.ts` for complete type definitions.
