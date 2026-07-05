# Exam Management Lambda Functions

This directory contains Lambda functions for managing exams in the AI-Powered Exam Grading System.

## Planned Functions

- `create-exam.ts` - Create a new exam with questionnaire and answer key
- `get-exam.ts` - Retrieve exam details by ID
- `list-exams.ts` - List all exams for a customer
- `update-exam.ts` - Update exam questions and metadata
- `delete-exam.ts` - Delete an exam

## Data Model

All exam data is stored in the `DocumentPlatform-Exams` DynamoDB table with the following structure:

- **PK**: `CUSTOMER#{customerId}` - Partition key for multi-tenant isolation
- **SK**: `EXAM#{examId}` - Sort key for exam identification
- **GSI1**: Teacher index (`TEACHER#{teacherId}` / `EXAM#{createdAt}`)

See `backend/lambdas/layers/shared/nodejs/exam-types.ts` for complete type definitions.
