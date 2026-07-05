# Implementation Plan: AI-Powered Exam Grading System

## Overview

This implementation plan breaks down the AI-Powered Exam Grading System into incremental coding tasks. The system will be built using TypeScript, AWS Lambda, DynamoDB, S3, Textract, and Bedrock. The implementation follows a bottom-up approach: core data models → document processing → AI grading → API endpoints → frontend components.

## Tasks

- [x] 1. Set up project structure and core data models
  - Create directory structure for backend Lambda functions
  - Define TypeScript interfaces for all data models (Exam, Question, Submission, GradingResult, etc.)
  - Create DynamoDB table schemas with partition/sort keys and GSIs
  - Set up shared types package for use across Lambda functions
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 20.4_

- [ ]* 1.1 Write property test for data model validation
  - **Property 24: Data persistence round trip**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6**

- [x] 2. Implement document format validation
  - [x] 2.1 Create DocumentProcessor class with format validation methods
    - Implement validateDocumentFormat() to check file signatures/magic numbers
    - Support PDF, DOCX, PNG, JPG format detection
    - Return clear error messages for unsupported formats
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ]* 2.2 Write property tests for format validation
    - **Property 1: Valid document format acceptance**
    - **Property 2: Invalid document format rejection**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

- [-] 3. Implement exam questionnaire processing
  - [x] 3.1 Create question extraction logic using AWS Textract
    - Implement extractQuestionsFromQuestionnaire() method
    - Use Textract AnalyzeDocument API with TABLES and FORMS features
    - Implement heuristics to detect question boundaries (numbered patterns)
    - Parse section headers and group questions by section
    - Preserve original question numbering
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [ ]* 3.2 Write property tests for question extraction
    - **Property 3: Question extraction completeness**
    - **Property 4: Section grouping preservation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
  
  - [x] 3.3 Add error handling for extraction failures
    - Implement retry logic for Textract failures
    - Return diagnostic error messages
    - Store partial results when possible
    - _Requirements: 2.6_

- [ ] 4. Implement answer key processing
  - [x] 4.1 Create answer key extraction logic
    - Implement extractAnswerKeyMappings() method
    - Parse question-answer pairs from document
    - Extract keywords from expected answers
    - Validate completeness of answer key
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 4.2 Write property tests for answer key processing
    - **Property 5: Answer key mapping completeness**
    - **Property 6: Answer key validation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [ ] 5. Checkpoint - Ensure document processing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement handwriting recognition
  - [x] 6.1 Create HandwritingRecognizer class
    - Implement extractHandwrittenAnswers() method
    - Use AWS Textract with SIGNATURES feature type
    - Implement spatial analysis to map text blocks to question numbers
    - Calculate confidence scores from Textract response
    - Flag low-confidence answers (<50%) for manual review
    - Handle multi-page submissions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 6.2 Write property tests for handwriting recognition
    - **Property 7: Multi-page handwriting extraction**
    - **Property 8: Handwriting recognition data persistence**
    - **Property 9: Low confidence flagging**
    - **Validates: Requirements 4.2, 4.4, 4.5, 4.6**

- [ ] 7. Implement AI grading engine
  - [x] 7.1 Create AIGradingEngine class with Bedrock integration
    - Implement gradeAnswer() method for single question grading
    - Construct prompts with question context, expected answer, student answer
    - Call Amazon Bedrock Claude API for semantic comparison
    - Parse JSON response for marks, confidence, explanation
    - Implement retry logic with exponential backoff
    - Track token usage for cost calculation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 7.2 Implement batch grading logic
    - Implement batchGradeSubmission() method
    - Process all questions in a submission
    - Calculate total score and average confidence
    - Flag questions with confidence <70% for manual review
    - Aggregate cost tracking data
    - _Requirements: 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 7.3 Write property tests for AI grading
    - **Property 10: Semantic equivalence recognition**
    - **Property 11: Confidence score bounds**
    - **Property 12: Grading explanation presence**
    - **Property 13: Partial credit bounds**
    - **Property 14: Grading result completeness**
    - **Property 15: Total score calculation**
    - **Validates: Requirements 5.2, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.5**
  
  - [x] 7.4 Add error handling for AI grading failures
    - Handle Bedrock API failures with retries
    - Handle timeout errors
    - Implement rate limiting with token bucket
    - Flag failed questions for manual grading
    - _Requirements: 19.4_

- [ ] 8. Checkpoint - Ensure AI grading tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement exam management service
  - [x] 9.1 Create ExamManagementService class
    - Implement createExam() to store exam in DynamoDB
    - Implement getExam() to retrieve exam by ID
    - Implement listExams() with customer filtering
    - Implement updateExamQuestions() for wizard edits
    - Implement deleteExam() with cascade deletion
    - Include customerId in all operations
    - _Requirements: 10.1, 10.2, 20.1, 20.2, 20.4_
  
  - [ ]* 9.2 Write property tests for exam management
    - **Property 29: Dashboard exam display**
    - **Property 41: Multi-tenant exam association**
    - **Property 42: Multi-tenant data isolation**
    - **Validates: Requirements 12.3, 12.4, 20.1, 20.2, 20.4**

- [ ] 10. Implement submission management service
  - [x] 10.1 Create SubmissionManagementService class
    - Implement createSubmission() to store submission in DynamoDB
    - Implement getSubmission() to retrieve submission by ID
    - Implement listSubmissions() filtered by exam and customer
    - Implement updateGrade() for manual overrides
    - Implement finalizeSubmission() to mark as complete
    - Store manual override metadata (teacher ID, timestamp, reason)
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 10.3, 10.4, 10.5_
  
  - [ ]* 10.2 Write property tests for submission management
    - **Property 17: Grade override preservation**
    - **Property 18: Grade finalization state**
    - **Property 33: Student results display**
    - **Property 35: Grade modification reason requirement**
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.6, 10.5, 15.1, 15.2, 16.4**

- [ ] 11. Implement cost tracking
  - [x] 11.1 Create CostTrackingService class
    - Implement recordTextractUsage() to log page counts
    - Implement recordBedrockUsage() to log token counts
    - Implement calculateTextractCost() using AWS pricing
    - Implement calculateBedrockCost() using AWS pricing
    - Implement aggregateCostsByCustomer() for cumulative costs
    - Implement checkCostThreshold() for notifications
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [ ]* 11.2 Write property tests for cost tracking
    - **Property 25: Cost tracking recording**
    - **Property 26: Cost calculation accuracy**
    - **Property 27: Cost aggregation per customer**
    - **Property 28: Cost threshold notification**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6**

- [ ] 12. Implement export service
  - [x] 12.1 Create ExportService class
    - Implement exportToCSV() using csv-stringify library
    - Implement exportToExcel() using exceljs library
    - Include all required fields: student info, marks, confidence, explanations, overrides
    - Upload export files to S3 with pre-signed URLs
    - Set URL expiration to 1 hour
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ]* 12.2 Write property tests for export service
    - **Property 22: Export format generation**
    - **Property 23: Export data completeness**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [ ] 13. Checkpoint - Ensure all backend services tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement batch processing with SQS
  - [x] 14.1 Create batch submission handler
    - Implement Lambda function to accept batch uploads
    - Send each submission to SQS queue for processing
    - Track batch processing status in DynamoDB
    - Emit progress events for each submission
    - _Requirements: 8.1, 8.4_
  
  - [x] 14.2 Create SQS consumer Lambda for grading
    - Implement Lambda triggered by SQS messages
    - Process one submission per invocation
    - Handle failures with DLQ (dead letter queue)
    - Continue processing on individual failures
    - Update submission status after processing
    - _Requirements: 8.6_
  
  - [ ]* 14.3 Write property tests for batch processing
    - **Property 19: Batch upload acceptance**
    - **Property 20: Batch processing error isolation**
    - **Property 21: Batch processing progress tracking**
    - **Property 39: Batch processing resumption**
    - **Validates: Requirements 8.1, 8.4, 8.6, 19.5**

- [ ] 15. Implement API Gateway endpoints
  - [x] 15.1 Create exam management endpoints
    - POST /exams - Create new exam
    - GET /exams/:examId - Get exam details
    - GET /exams - List exams for customer
    - PUT /exams/:examId/questions - Update questions
    - DELETE /exams/:examId - Delete exam
    - Add authentication and authorization middleware
    - Validate request bodies
    - _Requirements: 20.1, 20.2_
  
  - [x] 15.2 Create submission management endpoints
    - POST /exams/:examId/submissions - Upload submission
    - POST /exams/:examId/submissions/batch - Batch upload
    - GET /submissions/:submissionId - Get submission details
    - GET /exams/:examId/submissions - List submissions for exam
    - PUT /submissions/:submissionId/grades/:questionNumber - Update grade
    - POST /submissions/:submissionId/finalize - Finalize submission
    - _Requirements: 7.3, 14.4_
  
  - [x] 15.3 Create export endpoints
    - GET /exams/:examId/export/csv - Export to CSV
    - GET /exams/:examId/export/excel - Export to Excel
    - Return pre-signed S3 URLs
    - _Requirements: 9.6_
  
  - [ ]* 15.4 Write integration tests for API endpoints
    - Test authentication and authorization
    - Test request validation
    - Test error responses
    - Test multi-tenant data isolation

- [ ] 16. Implement error handling across all Lambda functions
  - [x] 16.1 Add comprehensive error handling
    - Implement retry logic for AWS service calls
    - Add error logging with context
    - Return user-friendly error messages
    - Preserve successfully processed data on errors
    - _Requirements: 19.1, 19.2, 19.3, 19.6_
  
  - [ ]* 16.2 Write property tests for error handling
    - **Property 38: AI grading failure flagging**
    - **Property 40: Error data preservation**
    - **Validates: Requirements 19.4, 19.6**

- [ ] 17. Implement multi-tenant authorization
  - [ ] 17.1 Create authorization middleware
    - Extract customerId from JWT token
    - Validate customer access to resources
    - Deny cross-customer access attempts
    - Log unauthorized access attempts
    - _Requirements: 20.6_
  
  - [ ]* 17.2 Write property tests for authorization
    - **Property 43: Cross-customer access denial**
    - **Validates: Requirements 20.6**

- [ ] 18. Checkpoint - Ensure all backend integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Implement frontend Advanced section navigation
  - [x] 19.1 Add "Advanced" navigation item to Layout component
    - Add new navigation link in Layout.tsx
    - Create route for /advanced path
    - Display exam grading dashboard as landing page
    - _Requirements: 12.1, 12.2_
  
  - [x] 19.2 Create exam grading dashboard component
    - Display list of all exams for customer
    - Show exam title, creation date, submission count, status
    - Add quick action buttons: Create Exam, Upload Submissions
    - Implement filtering by status
    - Implement sorting by date, title
    - _Requirements: 12.3, 12.4, 12.5_

- [x] 20. Implement exam creation wizard
  - [x] 20.1 Create wizard component with step navigation
    - Create multi-step wizard UI with progress indicator
    - Step 1: Upload questionnaire (drag-drop or file picker)
    - Step 2: Review extracted questions (editable table)
    - Step 3: Upload answer key
    - Step 4: Review answer mappings (validation display)
    - Step 5: Confirm and create exam
    - _Requirements: 13.1, 13.2_
  
  - [x] 20.2 Implement questionnaire upload and review
    - Add file upload component with format validation
    - Display extracted questions in editable table
    - Allow editing question text and section assignments
    - Show extraction confidence scores
    - _Requirements: 13.3, 13.4_
  
  - [x] 20.3 Implement answer key upload and validation
    - Add file upload component for answer key
    - Display question-answer mappings
    - Highlight missing answers
    - Show validation errors
    - _Requirements: 13.5_
  
  - [x] 20.4 Implement exam creation completion
    - Save exam on wizard completion
    - Navigate back to dashboard
    - Show success notification
    - _Requirements: 13.6_
  
  - [ ]* 20.5 Write property test for wizard workflow
    - **Property 30: Wizard question review and edit**
    - **Validates: Requirements 13.3, 13.6**

- [x] 21. Implement submission upload interface
  - [x] 21.1 Create submission upload component
    - Add single file upload with student info form
    - Add batch upload with CSV mapping
    - Validate required student identification
    - Display progress indicators during upload
    - Show confirmation on successful upload
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_
  
  - [ ]* 21.2 Write property tests for upload validation
    - **Property 31: Submission upload validation**
    - **Property 32: Upload completion workflow**
    - **Validates: Requirements 14.4, 14.6**

- [x] 22. Implement grading results dashboard
  - [x] 22.1 Create results dashboard component
    - Display table of all students with total scores
    - Show grading status for each student (Graded, Review Required, Finalized)
    - Implement color-coded confidence indicators (green/yellow/red)
    - Add filter by status dropdown
    - Add sort by score, confidence, name
    - _Requirements: 15.1, 15.2, 15.5_
  
  - [x] 22.2 Create per-question breakdown view
    - Display detailed view when student is selected
    - Show marks, confidence scores, explanations for each question
    - Highlight questions flagged for manual review
    - Add navigation between students
    - _Requirements: 15.3, 15.4, 15.6_
  
  - [ ]* 22.3 Write property test for confidence color coding
    - **Property 34: Confidence color coding**
    - **Validates: Requirements 15.5**

- [x] 23. Implement manual review interface
  - [x] 23.1 Create manual review component
    - Display split view: student answer (left), expected answer (right)
    - Show AI grade, confidence score, explanation
    - Add grade input field with validation
    - Add reason text area (required for modifications)
    - Add Approve, Modify, Reject buttons
    - Implement navigation: Previous/Next flagged question
    - Show progress indicator: "X of Y questions reviewed"
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_
  
  - [ ]* 23.2 Write property test for manual review
    - **Property 16: Manual review flag display**
    - **Validates: Requirements 7.1, 16.1**

- [x] 24. Implement bulk actions
  - [x] 24.1 Create bulk action component
    - Add "Bulk Approve High Confidence" button
    - Show preview count of grades to be affected
    - Add confirmation dialog before applying
    - Apply bulk approve to grades with confidence ≥80%
    - Mark all approved grades as finalized
    - Display summary of approved grades
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_
  
  - [ ]* 24.2 Write property tests for bulk actions
    - **Property 36: Bulk approve high confidence filter**
    - **Property 37: Bulk action preview count**
    - **Validates: Requirements 17.2, 17.4, 17.6**

- [x] 25. Implement export functionality
  - [x] 25.1 Create export component
    - Add "Export to CSV" button
    - Add "Export to Excel" button
    - Show loading indicator during export generation
    - Automatically download file when ready
    - Show error message if export fails
    - _Requirements: 9.1, 9.2, 9.6_

- [x] 26. Implement visual feedback for processing
  - [x] 26.1 Create progress indicator components
    - Add progress bar for document processing
    - Show current processing stage (Uploading, Extracting, Grading)
    - Display estimated time remaining
    - Show per-document progress for batch uploads
    - Display success/error messages on completion
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 27. Checkpoint - Ensure all frontend components render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 28. Implement error recovery UI
  - [x] 28.1 Add error handling to all frontend components
    - Display specific error messages for upload failures
    - Provide retry option for failed operations
    - Offer manual entry option for extraction failures
    - Show actionable guidance for all errors
    - _Requirements: 19.1, 19.2, 19.3_

- [x] 29. Wire backend and frontend together
  - [x] 29.1 Connect frontend to API endpoints
    - Implement API client service with authentication
    - Connect exam creation wizard to POST /exams
    - Connect submission upload to POST /submissions
    - Connect grading dashboard to GET /submissions
    - Connect manual review to PUT /grades
    - Connect export to GET /export endpoints
    - Add error handling for all API calls
  
  - [ ] 29.2 Implement real-time updates
    - Add WebSocket or polling for batch processing status
    - Update UI when submissions complete processing
    - Show notifications for grading completion
    - _Requirements: 8.5_

- [x] 30. Deploy infrastructure
  - [x] 30.1 Create CDK stack for exam grading system
    - Define DynamoDB tables with GSIs
    - Define S3 bucket with appropriate policies
    - Define Lambda functions with appropriate IAM roles
    - Define SQS queue and DLQ
    - Define API Gateway with authorizer
    - Configure Textract and Bedrock permissions
    - Set up CloudWatch logging and monitoring
  
  - [ ] 30.2 Deploy to AWS
    - Run CDK deploy command
    - Verify all resources created successfully
    - Test API endpoints with Postman/curl
    - Verify multi-tenant isolation

- [ ] 31. Final checkpoint - End-to-end testing
  - [ ] 31.1 Test complete exam creation workflow
    - Upload questionnaire, verify extraction
    - Upload answer key, verify validation
    - Create exam, verify storage
  
  - [ ] 31.2 Test complete grading workflow
    - Upload student submission
    - Verify handwriting extraction
    - Verify AI grading
    - Review and override grades
    - Finalize submission
    - Export results
  
  - [ ] 31.3 Test batch processing
    - Upload 10 student submissions
    - Verify all process successfully
    - Verify progress tracking
    - Verify cost tracking
  
  - [ ] 31.4 Test multi-tenant isolation
    - Create exams for different customers
    - Verify data isolation
    - Verify cross-customer access denial
  
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: data models → services → API → frontend
- All code should include proper error handling and logging
- Multi-tenant isolation must be enforced at every layer
