import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { examApi } from '../services/exam-api';
import { documentApi } from '../services/api';

interface Question {
  questionNumber: number;
  text: string;
  section: string;
  points: number;
  confidence?: number;
}

interface AnswerMapping {
  questionNumber: number;
  expectedAnswer: string;
  keywords: string[];
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

export default function CreateExamWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [examTitle, setExamTitle] = useState('');
  
  // Step 1: Questionnaire upload
  const [questionnaireFile, setQuestionnaireFile] = useState<File | null>(null);
  const [questionnaireS3Key, setQuestionnaireS3Key] = useState<string>('');
  const [uploadingQuestionnaire, setUploadingQuestionnaire] = useState(false);
  
  // Step 2: Review questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  
  // Step 3: Answer key upload
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [uploadingAnswerKey, setUploadingAnswerKey] = useState(false);
  
  // Step 4: Review answer mappings
  const [answerMappings, setAnswerMappings] = useState<AnswerMapping[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Step 5: Confirmation
  const [creating, setCreating] = useState(false);

  const handleQuestionnaireUpload = async (file: File) => {
    setQuestionnaireFile(file);
    setUploadingQuestionnaire(true);
    
    try {
      // Get pre-signed upload URL
      const uploadData = await documentApi.getUploadUrl(file.name, file.type);
      
      // Upload file to S3
      await documentApi.uploadFile(uploadData.uploadUrl, file);
      
      // Store S3 URL (s3://bucket/key format) for later use
      const s3Bucket = import.meta.env.VITE_S3_BUCKET || 'document-platform-380018306486-us-east-1';
      const s3Url = `s3://${s3Bucket}/${uploadData.s3Key}`;
      setQuestionnaireS3Key(s3Url);
      
      // Move to next step - we'll extract questions when creating the exam
      setCurrentStep(2);
      
      // Show placeholder message
      setQuestions([
        { questionNumber: 0, text: 'Questions will be extracted when you upload the answer key and create the exam...', section: 'Processing', points: 0, confidence: 0 },
      ]);
    } catch (error) {
      console.error('Failed to upload questionnaire:', error);
      alert('Failed to upload questionnaire. Please try again.');
    } finally {
      setUploadingQuestionnaire(false);
    }
  };

  const handleAnswerKeyUpload = async (file: File) => {
    setAnswerKeyFile(file);
    setUploadingAnswerKey(true);
    
    try {
      // Get pre-signed upload URL
      const uploadData = await documentApi.getUploadUrl(file.name, file.type);
      
      // Upload file to S3
      await documentApi.uploadFile(uploadData.uploadUrl, file);
      
      // Construct S3 URL (s3://bucket/key format)
      const s3Bucket = import.meta.env.VITE_S3_BUCKET || 'document-platform-380018306486-us-east-1';
      const answerKeyS3Url = `s3://${s3Bucket}/${uploadData.s3Key}`;
      
      // Now create the exam with both files - this will trigger document processing
      const teacherId = 'current-user'; // TODO: Get from auth context
      const exam = await examApi.createExam({
        title: examTitle,
        teacherId,
        questionnaireUrl: questionnaireS3Key,
        answerKeyUrl: answerKeyS3Url,
      });
      
      // Extract questions from the response
      const extractedQuestions: Question[] = [];
      exam.questionnaire.sections.forEach((section: any) => {
        section.questions.forEach((q: any) => {
          extractedQuestions.push({
            questionNumber: parseInt(q.questionNumber),
            text: q.questionText,
            section: section.sectionTitle,
            points: q.points,
            confidence: exam.questionnaire.extractionConfidence,
          });
        });
      });
      
      setQuestions(extractedQuestions);
      
      // Extract answer mappings
      const mappings: AnswerMapping[] = exam.answerKey.map((mapping: any) => ({
        questionNumber: parseInt(mapping.questionNumber),
        expectedAnswer: mapping.expectedAnswer,
        keywords: mapping.keywords,
      }));
      
      setAnswerMappings(mappings);
      
      // Validate and move to step 4
      validateAnswerMappings();
      setCurrentStep(4);
    } catch (error) {
      console.error('Failed to create exam:', error);
      alert('Failed to process files and create exam. Please try again.');
    } finally {
      setUploadingAnswerKey(false);
    }
  };

  const validateAnswerMappings = () => {
    const errors: string[] = [];
    const mappedQuestions = new Set(answerMappings.map(m => m.questionNumber));
    
    questions.forEach(q => {
      if (!mappedQuestions.has(q.questionNumber)) {
        errors.push(`Question ${q.questionNumber} is missing an answer`);
      }
    });
    
    setValidationErrors(errors);
  };

  const handleCreateExam = async () => {
    setCreating(true);
    
    try {
      // TODO: Replace with actual API call
      // await examApi.createExam({
      //   title: examTitle,
      //   questions,
      //   answerMappings
      // });
      
      alert('Exam created successfully!');
      navigate('/advanced');
    } catch (error) {
      console.error('Failed to create exam:', error);
      alert('Failed to create exam. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return questionnaireFile !== null && examTitle.trim() !== '';
      case 2: return questions.length > 0;
      case 3: return answerKeyFile !== null;
      case 4: return validationErrors.length === 0;
      case 5: return true; // Title already validated in step 1
      default: return false;
    }
  };

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4, 5].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step < currentStep
                  ? 'bg-green-500 text-white'
                  : step === currentStep
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step < currentStep ? <Check className="h-5 w-5" /> : step}
            </div>
            {step < 5 && (
              <div
                className={`w-16 h-1 mx-2 ${
                  step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-600">
        <span>Upload</span>
        <span>Review</span>
        <span>Answer Key</span>
        <span>Validate</span>
        <span>Confirm</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Exam</h1>
        <p className="mt-2 text-gray-600">Follow the steps to create and configure your exam</p>
      </div>

      {renderStepIndicator()}

      <div className="bg-white shadow rounded-lg p-6">
        {/* Step 1: Upload Questionnaire */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 1: Exam Details & Questionnaire</h2>
            
            {/* Exam Title Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exam Title *
              </label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="e.g., Midterm Exam - Biology 101"
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-4 py-2 border"
                required
              />
            </div>

            <p className="text-gray-600 mb-4">
              Upload the exam questionnaire document (PDF, DOCX, or image)
            </p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    Choose file or drag and drop
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleQuestionnaireUpload(file);
                    }}
                    disabled={uploadingQuestionnaire}
                  />
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  PDF, DOCX, PNG, or JPG up to 10MB
                </p>
              </div>
              {questionnaireFile && (
                <p className="mt-4 text-sm text-gray-700">
                  Selected: {questionnaireFile.name}
                </p>
              )}
            </div>
            
            {uploadingQuestionnaire && (
              <div className="mt-4 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-sm text-gray-600">Processing questionnaire...</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review Questions */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 2: Review Extracted Questions</h2>
            <p className="text-gray-600 mb-4">
              Review and edit the extracted questions. Click on any field to edit.
            </p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Question
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Section
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Points
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Confidence
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {questions.map((q, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm">{q.questionNumber}</td>
                      <td className="px-4 py-3">
                        {editingQuestion === idx ? (
                          <input
                            type="text"
                            value={q.text}
                            onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                            onBlur={() => setEditingQuestion(null)}
                            className="w-full border-gray-300 rounded-md"
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingQuestion(idx)}
                            className="cursor-pointer hover:bg-gray-50 p-1 rounded"
                          >
                            {q.text}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={q.section}
                          onChange={(e) => updateQuestion(idx, 'section', e.target.value)}
                          className="w-full border-gray-300 rounded-md text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={q.points}
                          onChange={(e) => updateQuestion(idx, 'points', parseInt(e.target.value))}
                          className="w-20 border-gray-300 rounded-md text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          (q.confidence || 0) >= 0.9 ? 'bg-green-100 text-green-800' :
                          (q.confidence || 0) >= 0.7 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {((q.confidence || 0) * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 3: Upload Answer Key */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 3: Upload Answer Key</h2>
            <p className="text-gray-600 mb-4">
              Upload the answer key document with expected answers
            </p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    Choose file or drag and drop
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAnswerKeyUpload(file);
                    }}
                    disabled={uploadingAnswerKey}
                  />
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  PDF, DOCX, PNG, or JPG up to 10MB
                </p>
              </div>
              {answerKeyFile && (
                <p className="mt-4 text-sm text-gray-700">
                  Selected: {answerKeyFile.name}
                </p>
              )}
            </div>
            
            {uploadingAnswerKey && (
              <div className="mt-4 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-sm text-gray-600">Processing answer key...</p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review Answer Mappings */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 4: Review Answer Mappings</h2>
            <p className="text-gray-600 mb-4">
              Verify that all questions have corresponding answers
            </p>
            
            {validationErrors.length > 0 && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Validation Errors</h3>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                      {validationErrors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              {answerMappings.map((mapping, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        Question {mapping.questionNumber}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {questions.find(q => q.questionNumber === mapping.questionNumber)?.text}
                      </p>
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Expected Answer:</p>
                        <p className="mt-1 text-sm text-gray-600">{mapping.expectedAnswer}</p>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Keywords:</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {mapping.keywords.map((keyword, kidx) => (
                            <span
                              key={kidx}
                              className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Check className="h-5 w-5 text-green-500 ml-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Confirm and Create */}
        {currentStep === 5 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 5: Confirm and Create Exam</h2>
            <p className="text-gray-600 mb-4">
              Review the exam details before creating
            </p>
            
            <div className="space-y-4">
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <h3 className="font-medium text-indigo-900 mb-2">Exam Title</h3>
                <p className="text-lg text-indigo-800">{examTitle}</p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Exam Summary</h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Total Questions</dt>
                    <dd className="font-medium text-gray-900">{questions.length}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Total Points</dt>
                    <dd className="font-medium text-gray-900">
                      {questions.reduce((sum, q) => sum + q.points, 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Sections</dt>
                    <dd className="font-medium text-gray-900">
                      {new Set(questions.map(q => q.section)).size}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Answer Mappings</dt>
                    <dd className="font-medium text-gray-900">{answerMappings.length}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={() => {
              if (currentStep > 1) {
                setCurrentStep((currentStep - 1) as WizardStep);
              } else {
                navigate('/advanced');
              }
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          {currentStep < 5 ? (
            <button
              onClick={() => {
                if (currentStep === 2) {
                  setCurrentStep(3);
                } else if (canProceed()) {
                  setCurrentStep((currentStep + 1) as WizardStep);
                }
              }}
              disabled={!canProceed()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleCreateExam}
              disabled={!canProceed() || creating}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Exam'}
              <Check className="h-4 w-4 ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
