/**
 * Integration Test Setup
 * Sets environment variables before any modules are loaded
 */

// Set AWS configuration
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.EXAMS_TABLE_NAME = 'DocumentPlatform-Exams';
process.env.SUBMISSIONS_TABLE_NAME = 'DocumentPlatform-Submissions';
process.env.BUCKET_NAME = process.env.BUCKET_NAME || 'document-platform-380018306486-us-east-1';

console.log('✓ Integration test environment configured');
console.log(`  AWS_REGION: ${process.env.AWS_REGION}`);
console.log(`  EXAMS_TABLE_NAME: ${process.env.EXAMS_TABLE_NAME}`);
console.log(`  SUBMISSIONS_TABLE_NAME: ${process.env.SUBMISSIONS_TABLE_NAME}`);
console.log(`  BUCKET_NAME: ${process.env.BUCKET_NAME}`);
