/**
 * Create Test Exam Manually
 * 
 * Creates an exam with sample questions directly in DynamoDB
 * This bypasses the document extraction step for testing
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const REGION = process.env.AWS_REGION || 'us-east-1';
const EXAMS_TABLE = process.env.EXAMS_TABLE_NAME || 'DocumentPlatform-Exams';
const CUSTOMER_ID = 'test-customer-manual';
const TEACHER_ID = 'teacher-manual-test';

// Sample questions from Grade 11 exam (you can modify these)
const sampleQuestions = [
  {
    questionNumber: '1',
    questionText: 'Define photosynthesis and explain its importance in the ecosystem.',
    points: 10,
    sectionId: 'section-1',
  },
  {
    questionNumber: '2',
    questionText: 'Describe the water cycle and identify the main stages.',
    points: 10,
    sectionId: 'section-1',
  },
  {
    questionNumber: '3',
    questionText: 'What is the difference between renewable and non-renewable energy sources? Provide examples.',
    points: 10,
    sectionId: 'section-1',
  },
  {
    questionNumber: '4',
    questionText: 'Explain the concept of climate change and its main causes.',
    points: 15,
    sectionId: 'section-2',
  },
  {
    questionNumber: '5',
    questionText: 'Describe three ways humans can reduce their environmental impact.',
    points: 15,
    sectionId: 'section-2',
  },
];

const sampleAnswerKey = [
  {
    questionNumber: '1',
    expectedAnswer: 'Photosynthesis is the process by which plants convert light energy into chemical energy (glucose) using carbon dioxide and water. It is important because it produces oxygen for other organisms and forms the base of most food chains.',
    keywords: ['light energy', 'chemical energy', 'glucose', 'carbon dioxide', 'water', 'oxygen', 'food chain'],
  },
  {
    questionNumber: '2',
    expectedAnswer: 'The water cycle is the continuous movement of water on, above, and below the surface of Earth. Main stages include: evaporation (water turns to vapor), condensation (vapor forms clouds), precipitation (rain/snow falls), and collection (water gathers in bodies of water).',
    keywords: ['evaporation', 'condensation', 'precipitation', 'collection', 'continuous movement'],
  },
  {
    questionNumber: '3',
    expectedAnswer: 'Renewable energy sources can be replenished naturally (solar, wind, hydro, geothermal). Non-renewable sources are finite and will eventually run out (coal, oil, natural gas, nuclear). Renewable sources are more sustainable for long-term use.',
    keywords: ['renewable', 'non-renewable', 'solar', 'wind', 'coal', 'oil', 'sustainable', 'finite'],
  },
  {
    questionNumber: '4',
    expectedAnswer: 'Climate change refers to long-term shifts in global temperatures and weather patterns. Main causes include: burning fossil fuels (releases CO2), deforestation (reduces CO2 absorption), industrial processes, and agriculture (methane emissions). These increase greenhouse gases in the atmosphere.',
    keywords: ['temperature', 'weather patterns', 'fossil fuels', 'CO2', 'deforestation', 'greenhouse gases', 'methane'],
  },
  {
    questionNumber: '5',
    expectedAnswer: 'Three ways to reduce environmental impact: 1) Reduce energy consumption (use LED bulbs, turn off devices), 2) Reduce waste (recycle, compost, avoid single-use plastics), 3) Use sustainable transportation (walk, bike, public transit, electric vehicles).',
    keywords: ['reduce energy', 'recycle', 'compost', 'sustainable transportation', 'LED', 'public transit'],
  },
];

async function createTestExam() {
  console.log('📝 Creating Test Exam Manually');
  console.log('='.repeat(60));
  console.log(`Region: ${REGION}`);
  console.log(`Table: ${EXAMS_TABLE}`);
  console.log(`Customer: ${CUSTOMER_ID}`);
  console.log('');

  const dynamoClient = new DynamoDBClient({ region: REGION });
  const docClient = DynamoDBDocumentClient.from(dynamoClient);

  const examId = `exam-${randomUUID()}`;
  const timestamp = new Date().toISOString();

  const exam = {
    PK: `CUSTOMER#${CUSTOMER_ID}`,
    SK: `EXAM#${examId}`,
    examId,
    customerId: CUSTOMER_ID,
    title: 'Grade 11 Mid-Year Exam - January 2026 (Manual Test)',
    description: 'Test exam created manually for testing the grading workflow',
    teacherId: TEACHER_ID,
    status: 'ACTIVE',
    createdAt: timestamp,
    updatedAt: timestamp,
    
    // Sections
    sections: [
      {
        sectionNumber: 1,
        sectionTitle: 'Biology and Environment',
        questions: sampleQuestions.filter(q => q.sectionId === 'section-1'),
      },
      {
        sectionNumber: 2,
        sectionTitle: 'Climate and Sustainability',
        questions: sampleQuestions.filter(q => q.sectionId === 'section-2'),
      },
    ],
    
    totalQuestions: sampleQuestions.length,
    totalPoints: sampleQuestions.reduce((sum, q) => sum + q.points, 0),
    
    // Answer key (stored as answerMappings in DynamoDB)
    answerMappings: sampleAnswerKey,
    
    // Metadata
    extractionConfidence: 100, // Manual entry, so 100% confidence
    questionnaireS3Key: 'manual-entry',
    answerKeyS3Key: 'manual-entry',
    submissionCount: 0,
    totalCost: 0,
    
    // GSI attributes
    GSI1PK: `TEACHER#${TEACHER_ID}`,
    GSI1SK: `EXAM#${timestamp}`,
  };

  try {
    await docClient.send(new PutCommand({
      TableName: EXAMS_TABLE,
      Item: exam,
    }));

    console.log('✅ Exam created successfully!');
    console.log('');
    console.log('Exam Details:');
    console.log(`  ID: ${examId}`);
    console.log(`  Title: ${exam.title}`);
    console.log(`  Questions: ${exam.totalQuestions}`);
    console.log(`  Total Points: ${exam.totalPoints}`);
    console.log(`  Sections: ${exam.sections.length}`);
    console.log('');
    console.log('Questions:');
    exam.sections.forEach((section) => {
      console.log(`\n  ${section.sectionTitle}:`);
      section.questions.forEach((q) => {
        console.log(`    Q${q.questionNumber} (${q.points}pts): ${q.questionText.substring(0, 60)}...`);
      });
    });
    console.log('');
    console.log('🎉 You can now test the system!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Open the UI and navigate to Advanced → Exam Grading');
    console.log('  2. You should see the exam in the list');
    console.log('  3. Upload student submissions (answer1.jpeg - answer5.jpeg)');
    console.log('  4. Watch the AI grade them!');
    console.log('');
    console.log(`Exam ID for API calls: ${examId}`);
    console.log(`Customer ID: ${CUSTOMER_ID}`);

  } catch (error) {
    console.error('❌ Failed to create exam:', error);
    process.exit(1);
  }
}

createTestExam();
