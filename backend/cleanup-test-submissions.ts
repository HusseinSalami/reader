/**
 * Cleanup Test Submissions
 * 
 * Removes all test submissions from DynamoDB for the test exam
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE_NAME || 'DocumentPlatform-Submissions';
const TEST_EXAM_PREFIX = 'exam-'; // Will delete all submissions for exams starting with this

async function cleanupSubmissions() {
  console.log('🧹 Cleaning Up Test Submissions');
  console.log('='.repeat(60));
  console.log(`Region: ${REGION}`);
  console.log(`Table: ${SUBMISSIONS_TABLE}`);
  console.log('');

  const dynamoClient = new DynamoDBClient({ region: REGION });
  const docClient = DynamoDBDocumentClient.from(dynamoClient);

  try {
    // Scan the entire table to find all submissions
    const scanResult = await docClient.send(new ScanCommand({
      TableName: SUBMISSIONS_TABLE,
    }));

    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('✓ No submissions found to clean up');
      return;
    }

    console.log(`Found ${scanResult.Items.length} total submissions`);
    
    // Filter for test submissions (those with exam IDs)
    const testSubmissions = scanResult.Items.filter(item => 
      item.PK && item.PK.startsWith('EXAM#' + TEST_EXAM_PREFIX)
    );
    
    console.log(`Found ${testSubmissions.length} test submissions to delete`);
    console.log('');

    if (testSubmissions.length === 0) {
      console.log('✓ No test submissions to clean up');
      return;
    }

    console.log(`Found ${testSubmissions.length} test submissions to delete`);
    console.log('');

    if (testSubmissions.length === 0) {
      console.log('✓ No test submissions to clean up');
      return;
    }

    // Delete each submission
    let deletedCount = 0;
    for (const item of testSubmissions) {
      try {
        await docClient.send(new DeleteCommand({
          TableName: SUBMISSIONS_TABLE,
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
        }));
        
        deletedCount++;
        console.log(`✓ Deleted: ${item.submissionId} (${item.studentName || 'Unknown'}) from ${item.PK}`);
      } catch (error) {
        console.error(`✗ Failed to delete ${item.submissionId}:`, error);
      }
    }

    console.log('');
    console.log(`✅ Cleanup complete! Deleted ${deletedCount} submissions`);

  } catch (error) {
    console.error('❌ Failed to cleanup submissions:', error);
    process.exit(1);
  }
}

cleanupSubmissions();
