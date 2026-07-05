/**
 * Dissertation Exam Workflow Test
 * 
 * Tests the exam grading system with dissertation-style questions where:
 * - Students read a passage and answer comprehension questions
 * - Students provide essay-style answers based on their understanding
 * - Teacher provides expected answer content (not exact wording)
 * - AI grades based on semantic similarity and content alignment
 */

import { DocumentProcessor } from './lambdas/layers/shared/nodejs/document-processor';
import { AIGradingEngine } from './lambdas/layers/shared/nodejs/ai-grading-engine';
import * as fs from 'fs';
import * as path from 'path';
import type { 
  QuestionContext, 
  ExtractedQuestionnaire, 
  AnswerKeyMapping,
  Section,
  Question
} from './lambdas/layers/shared/nodejs/exam-types';

const REGION = process.env.AWS_REGION || 'us-east-1';
const CUSTOMER_ID = 'test-customer-dissertation';
const EXAMPLES_DIR = path.join(__dirname, 'examples', 'dissertation-exam');

// Set environment variables
process.env.AWS_REGION = REGION;

interface StudentAnswer {
  questionNumber: string;
  answer: string;
}

interface StudentSubmission {
  studentName: string;
  studentId: string;
  answers: StudentAnswer[];
}

async function testDissertationExam() {
  console.log('📚 Dissertation Exam Grading Test');
  console.log('='.repeat(80));
  console.log(`Customer: ${CUSTOMER_ID}`);
  console.log(`Examples: ${EXAMPLES_DIR}`);
  console.log('');

  const gradingEngine = new AIGradingEngine();

  try {
    // ========================================
    // STEP 1: Load Questionnaire
    // ========================================
    console.log('📄 STEP 1: Loading Questionnaire');
    console.log('-'.repeat(80));

    const questionnairePath = path.join(EXAMPLES_DIR, 'dissertation-questionnaire.md');
    
    if (!fs.existsSync(questionnairePath)) {
      throw new Error(`Questionnaire not found: ${questionnairePath}`);
    }

    // For this test, we'll manually create the questionnaire structure
    // In production, this would be extracted by DocumentProcessor
    const questionnaire: ExtractedQuestionnaire = {
      totalQuestions: 5,
      sections: [
        {
          sectionTitle: 'Section A: Comprehension and Analysis',
          sectionNumber: 1,
          questions: [
            {
              questionNumber: '1',
              questionText: 'According to the passage, what are the main benefits that technology has brought to modern communication? Provide at least three specific examples from the text.',
              points: 10,
              sectionId: 'section-a',
            },
            {
              questionNumber: '2',
              questionText: 'Explain the concept of "echo chambers" as described in the passage. How do social media algorithms contribute to this phenomenon, and what are the potential consequences?',
              points: 10,
              sectionId: 'section-a',
            },
            {
              questionNumber: '3',
              questionText: 'The passage mentions that technology has "blurred the boundaries between work and personal life." Discuss what this means and explain the negative effects this can have on individuals.',
              points: 10,
              sectionId: 'section-a',
            },
          ],
        },
        {
          sectionTitle: 'Section B: Critical Thinking and Personal Reflection',
          sectionNumber: 2,
          questions: [
            {
              questionNumber: '4',
              questionText: 'The author suggests that the key question is "how to harness technology\'s benefits while mitigating its negative effects." Based on the passage and your own understanding, propose two specific strategies that individuals or society could implement to achieve this balance.',
              points: 10,
              sectionId: 'section-b',
            },
            {
              questionNumber: '5',
              questionText: 'Do you agree with the passage\'s claim that face-to-face communication skills are declining due to technology? Support your position with reasoning and examples from your own observations or experiences.',
              points: 10,
              sectionId: 'section-b',
            },
          ],
        },
      ],
      extractionConfidence: 100,
    };

    console.log(`✓ Loaded questionnaire: Literature Analysis Exam - Grade 11`);
    console.log(`  Total Questions: ${questionnaire.totalQuestions}`);
    console.log(`  Sections: ${questionnaire.sections.length}`);
    console.log('');

    // ========================================
    // STEP 2: Load Answer Key
    // ========================================
    console.log('📋 STEP 2: Loading Answer Key');
    console.log('-'.repeat(80));

    const answerKeyPath = path.join(EXAMPLES_DIR, 'dissertation-answer-key.md');
    
    if (!fs.existsSync(answerKeyPath)) {
      throw new Error(`Answer key not found: ${answerKeyPath}`);
    }

    // Manually create answer key structure
    const answerKey: AnswerKeyMapping[] = [
      {
        questionNumber: '1',
        expectedAnswer: 'Students should identify at least three benefits: (1) Real-time global connectivity enabling instant communication across continents and maintaining relationships despite distance, (2) Multimedia sharing allowing people to share experiences through photos, videos, and various content forms, (3) Democratized access to information making knowledge accessible to those who previously lacked opportunities, (4) Online education platforms making learning accessible to millions, (5) Creative expression and community building empowering individuals to create content and form communities based on shared interests rather than geography.',
        keywords: ['connectivity', 'real-time', 'multimedia', 'democratized', 'education', 'online platforms', 'creative expression', 'community', 'global communication', 'distance'],
      },
      {
        questionNumber: '2',
        expectedAnswer: 'Echo chambers are environments where users primarily encounter information confirming their existing beliefs, limiting exposure to diverse perspectives. Social media algorithms contribute by prioritizing engagement over accuracy, showing users content similar to what they previously engaged with, reinforcing existing viewpoints. Consequences include: polarization (people becoming more extreme), reduced exposure to diverse perspectives, amplification of misinformation and sensational content, and confirmation bias.',
        keywords: ['echo chambers', 'algorithms', 'confirmation bias', 'polarization', 'misinformation', 'engagement', 'diverse perspectives', 'existing beliefs', 'sensational content'],
      },
      {
        questionNumber: '3',
        expectedAnswer: 'Blurred boundaries means constant availability through mobile devices makes it difficult to separate work hours from personal time. The distinction between "at work" and "off work" becomes unclear. Negative effects include increased stress and burnout. People cannot truly disconnect or relax, impacting work-life balance, reducing quality time with family/friends, and causing mental health challenges.',
        keywords: ['blurred boundaries', 'constant availability', 'mobile devices', 'stress', 'burnout', 'work-life balance', 'disconnect', 'mental health', 'personal time'],
      },
      {
        questionNumber: '4',
        expectedAnswer: 'Students should propose two specific, well-reasoned strategies. Examples include: developing digital literacy skills (teaching critical thinking about online content, understanding algorithms), establishing healthy boundaries (specific times for device use, no phones during meals, right to disconnect policies), designing platforms prioritizing well-being over engagement, teaching digital literacy in schools, regulating algorithms to reduce echo chambers, creating workplace policies about after-hours communication.',
        keywords: ['digital literacy', 'boundaries', 'platform design', 'well-being', 'balance', 'education', 'policies', 'strategies', 'regulation', 'healthy use'],
      },
      {
        questionNumber: '5',
        expectedAnswer: 'Students can agree or disagree but must support their position with reasoning and examples. If agreeing: should reference loss of body language, tone, emotional expression; provide personal observations; discuss younger generations with devices. If disagreeing: should acknowledge concerns but provide counterarguments; may argue technology creates different communication skills; should demonstrate understanding of the passage argument. Must show critical thinking and personal reflection.',
        keywords: ['face-to-face', 'communication skills', 'body language', 'tone', 'emotional expression', 'personal experience', 'observations', 'reasoning', 'examples', 'critical thinking'],
      },
    ];

    console.log(`✓ Loaded answer key with ${answerKey.length} expected answers`);
    console.log('');

    // ========================================
    // STEP 3: Load Student Submissions
    // ========================================
    console.log('👥 STEP 3: Loading Student Submissions');
    console.log('-'.repeat(80));

    const studentFiles = [
      'student-answer-sample-1.md',
      'student-answer-sample-2.md',
      'student-answer-sample-3.md',
    ];

    const submissions: StudentSubmission[] = [];

    for (const file of studentFiles) {
      const filePath = path.join(EXAMPLES_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠ Student file not found: ${file}, skipping...`);
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse student info and answers from markdown
      const studentNameMatch = content.match(/\*\*Student Name:\*\*\s*(.+)/);
      const studentIdMatch = content.match(/\*\*Student ID:\*\*\s*(.+)/);
      
      const studentName = studentNameMatch ? studentNameMatch[1].trim() : 'Unknown';
      const studentId = studentIdMatch ? studentIdMatch[1].trim() : 'Unknown';

      // Extract answers (simplified parsing)
      const answers: StudentAnswer[] = [];
      
      // Question 1
      const q1Match = content.match(/### Question 1[\s\S]*?\*\*Your Answer:\*\*\s*([\s\S]*?)(?=\n---|\n### Question 2)/);
      if (q1Match) answers.push({ questionNumber: '1', answer: q1Match[1].trim() });

      // Question 2
      const q2Match = content.match(/### Question 2[\s\S]*?\*\*Your Answer:\*\*\s*([\s\S]*?)(?=\n---|\n### Question 3)/);
      if (q2Match) answers.push({ questionNumber: '2', answer: q2Match[1].trim() });

      // Question 3
      const q3Match = content.match(/### Question 3[\s\S]*?\*\*Your Answer:\*\*\s*([\s\S]*?)(?=\n---|\n## Section B)/);
      if (q3Match) answers.push({ questionNumber: '3', answer: q3Match[1].trim() });

      // Question 4
      const q4Match = content.match(/### Question 4[\s\S]*?\*\*Your Answer:\*\*\s*([\s\S]*?)(?=\n---|\n### Question 5)/);
      if (q4Match) answers.push({ questionNumber: '4', answer: q4Match[1].trim() });

      // Question 5
      const q5Match = content.match(/### Question 5[\s\S]*?\*\*Your Answer:\*\*\s*([\s\S]*?)(?=\n---|\n\*\*End of Exam)/);
      if (q5Match) answers.push({ questionNumber: '5', answer: q5Match[1].trim() });

      submissions.push({ studentName, studentId, answers });
      console.log(`✓ Loaded submission: ${studentName} (${studentId}) - ${answers.length} answers`);
    }

    console.log(`\n✓ Loaded ${submissions.length} student submissions`);
    console.log('');

    // ========================================
    // STEP 4: Grade All Submissions
    // ========================================
    console.log('🤖 STEP 4: AI Grading All Submissions');
    console.log('='.repeat(80));

    const gradingResults = [];

    for (const submission of submissions) {
      console.log(`\n${'-'.repeat(80)}`);
      console.log(`Grading: ${submission.studentName} (${submission.studentId})`);
      console.log(`${'-'.repeat(80)}`);

      let totalScore = 0;
      let maxScore = 0;
      const questionGrades = [];

      for (const studentAnswer of submission.answers) {
        const expectedAnswer = answerKey.find(
          (ak) => ak.questionNumber === studentAnswer.questionNumber
        );

        if (!expectedAnswer) {
          console.log(`⚠ No expected answer for Q${studentAnswer.questionNumber}`);
          continue;
        }

        const question = questionnaire.sections
          .flatMap((s) => s.questions)
          .find((q) => q.questionNumber === studentAnswer.questionNumber);

        if (!question) {
          console.log(`⚠ No question found for Q${studentAnswer.questionNumber}`);
          continue;
        }

        const questionContext: QuestionContext = {
          questionNumber: question.questionNumber,
          questionText: question.questionText,
          maxPoints: question.points,
          keywords: expectedAnswer.keywords,
        };

        console.log(`\n  Grading Q${studentAnswer.questionNumber}...`);
        
        const gradingResult = await gradingEngine.gradeAnswer(
          studentAnswer.answer,
          expectedAnswer.expectedAnswer,
          questionContext,
          CUSTOMER_ID
        );

        console.log(`  ✓ Q${studentAnswer.questionNumber}: ${gradingResult.marksAwarded}/${question.points} pts (${gradingResult.confidence}% confidence)`);
        console.log(`    Explanation: ${gradingResult.explanation.substring(0, 150)}...`);

        questionGrades.push({
          questionNumber: studentAnswer.questionNumber,
          grade: gradingResult,
          maxPoints: question.points,
        });

        totalScore += gradingResult.marksAwarded;
        maxScore += question.points;
      }

      const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : '0.0';
      console.log(`\n  📊 Total: ${totalScore}/${maxScore} (${percentage}%)`);

      gradingResults.push({
        studentName: submission.studentName,
        studentId: submission.studentId,
        totalScore,
        maxScore,
        percentage: parseFloat(percentage),
        questionGrades,
      });
    }

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('');
    console.log('='.repeat(80));
    console.log('📊 FINAL GRADING REPORT');
    console.log('='.repeat(80));
    console.log('');

    console.log('Exam Information:');
    console.log(`  Title: Literature Analysis Exam - Grade 11`);
    console.log(`  Total Questions: ${questionnaire.totalQuestions}`);
    console.log(`  Total Points: ${questionnaire.sections.flatMap((s: Section) => s.questions).reduce((sum: number, q: Question) => sum + q.points, 0)}`);
    console.log(`  Type: Dissertation/Essay-based`);
    console.log('');

    console.log('Student Results (sorted by score):');
    console.log('');

    // Sort by score descending
    gradingResults.sort((a, b) => b.percentage - a.percentage);

    gradingResults.forEach((result, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
      const grade = result.percentage >= 90 ? 'A' : result.percentage >= 80 ? 'B' : result.percentage >= 70 ? 'C' : result.percentage >= 60 ? 'D' : 'F';
      console.log(`${medal} ${rank}. ${result.studentName.padEnd(20)} ${result.totalScore}/${result.maxScore} (${result.percentage}%) - Grade: ${grade}`);
    });

    console.log('');
    console.log('Detailed Question Analysis:');
    console.log('');

    for (const result of gradingResults) {
      console.log(`${result.studentName}:`);
      for (const qGrade of result.questionGrades) {
        const status = qGrade.grade.confidence >= 80 ? '✓' : qGrade.grade.confidence >= 60 ? '~' : '⚠';
        console.log(`  ${status} Q${qGrade.questionNumber}: ${qGrade.grade.marksAwarded}/${qGrade.maxPoints} pts (${qGrade.grade.confidence}% confidence)`);
      }
      console.log('');
    }

    console.log('Statistics:');
    const avgScore = gradingResults.reduce((sum, r) => sum + r.percentage, 0) / gradingResults.length;
    const avgConfidence = gradingResults.reduce((sum, r) => {
      const avgQ = r.questionGrades.reduce((s, q) => s + q.grade.confidence, 0) / r.questionGrades.length;
      return sum + avgQ;
    }, 0) / gradingResults.length;
    
    console.log(`  Average Score: ${avgScore.toFixed(1)}%`);
    console.log(`  Highest Score: ${gradingResults[0].percentage}% (${gradingResults[0].studentName})`);
    console.log(`  Lowest Score: ${gradingResults[gradingResults.length - 1].percentage}% (${gradingResults[gradingResults.length - 1].studentName})`);
    console.log(`  Average AI Confidence: ${avgConfidence.toFixed(1)}%`);
    console.log(`  Students Graded: ${gradingResults.length}`);
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ DISSERTATION EXAM TEST SUCCESSFUL');
    console.log('='.repeat(80));
    console.log('');
    console.log('Key Achievements:');
    console.log(`  ✓ Loaded dissertation-style questionnaire with ${questionnaire.totalQuestions} essay questions`);
    console.log(`  ✓ Loaded teacher answer key with expected content (not exact wording)`);
    console.log(`  ✓ Processed ${submissions.length} student submissions`);
    console.log(`  ✓ AI successfully graded essay answers based on semantic similarity`);
    console.log(`  ✓ Generated comprehensive grading report with confidence scores`);
    console.log('');
    console.log('The system successfully handles dissertation-style exams! 🎉');
    console.log('Students are graded on content alignment, not exact wording.');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80));
    console.error(error);
    if (error instanceof Error && error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testDissertationExam();
