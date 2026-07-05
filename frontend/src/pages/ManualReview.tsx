import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, X, Edit, AlertTriangle } from 'lucide-react';

interface QuestionGrade {
  questionNumber: number;
  questionText: string;
  studentAnswer: string;
  expectedAnswer: string;
  aiGrade: number;
  maxPoints: number;
  confidence: number;
  explanation: string;
  flaggedForReview: boolean;
  manualOverride?: {
    grade: number;
    reason: string;
    reviewedBy: string;
    reviewedAt: string;
  };
}

interface Submission {
  submissionId: string;
  studentName: string;
  studentId: string;
  examTitle: string;
  grades: QuestionGrade[];
}

export default function ManualReview() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(true);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedGrade, setEditedGrade] = useState<number>(0);
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  useEffect(() => {
    if (submission) {
      const currentGrade = getCurrentGrade();
      setEditedGrade(currentGrade?.manualOverride?.grade ?? currentGrade?.aiGrade ?? 0);
      setEditReason('');
      setIsEditing(false);
    }
  }, [currentQuestionIndex, submission]);

  const loadSubmission = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await submissionApi.getSubmission(submissionId);
      // setSubmission(response);
      
      // Mock data
      setSubmission({
        submissionId: submissionId!,
        studentName: 'Jane Smith',
        studentId: 'S002',
        examTitle: 'Midterm Exam - Biology 101',
        grades: [
          {
            questionNumber: 1,
            questionText: 'What is the capital of France?',
            studentAnswer: 'Paris',
            expectedAnswer: 'Paris',
            aiGrade: 5,
            maxPoints: 5,
            confidence: 0.95,
            explanation: 'Perfect match with expected answer',
            flaggedForReview: false
          },
          {
            questionNumber: 2,
            questionText: 'Explain photosynthesis.',
            studentAnswer: 'Plants use sunlight to make food',
            expectedAnswer: 'Process by which plants convert light energy into chemical energy...',
            aiGrade: 6,
            maxPoints: 10,
            confidence: 0.62,
            explanation: 'Answer is partially correct but lacks detail about chlorophyll and glucose production',
            flaggedForReview: true
          },
          {
            questionNumber: 3,
            questionText: 'What is DNA?',
            studentAnswer: 'Genetic material',
            expectedAnswer: 'Deoxyribonucleic acid, the molecule that carries genetic information',
            aiGrade: 3,
            maxPoints: 5,
            confidence: 0.58,
            explanation: 'Answer is too brief and missing key details',
            flaggedForReview: true
          }
        ]
      });
    } catch (error) {
      console.error('Failed to load submission:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredGrades = () => {
    if (!submission) return [];
    return showOnlyFlagged
      ? submission.grades.filter(g => g.flaggedForReview)
      : submission.grades;
  };

  const getCurrentGrade = () => {
    const filtered = getFilteredGrades();
    return filtered[currentQuestionIndex];
  };

  const handleApprove = async () => {
    const currentGrade = getCurrentGrade();
    if (!currentGrade) return;

    try {
      setSaving(true);
      // TODO: Replace with actual API call
      // await submissionApi.approveGrade(submissionId, currentGrade.questionNumber);
      
      // Move to next question
      if (currentQuestionIndex < getFilteredGrades().length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        alert('All questions reviewed!');
        navigate(-1);
      }
    } catch (error) {
      console.error('Failed to approve grade:', error);
      alert('Failed to approve grade. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleModify = async () => {
    const currentGrade = getCurrentGrade();
    if (!currentGrade || !editReason.trim()) {
      alert('Please provide a reason for the modification');
      return;
    }

    try {
      setSaving(true);
      // TODO: Replace with actual API call
      // await submissionApi.updateGrade(submissionId, currentGrade.questionNumber, {
      //   grade: editedGrade,
      //   reason: editReason
      // });
      
      alert('Grade updated successfully!');
      setIsEditing(false);
      
      // Move to next question
      if (currentQuestionIndex < getFilteredGrades().length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        alert('All questions reviewed!');
        navigate(-1);
      }
    } catch (error) {
      console.error('Failed to update grade:', error);
      alert('Failed to update grade. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Please provide a reason for rejecting this grade:');
    if (!reason) return;

    try {
      setSaving(true);
      // TODO: Replace with actual API call
      // await submissionApi.rejectGrade(submissionId, getCurrentGrade()!.questionNumber, reason);
      
      alert('Grade rejected. Flagged for further review.');
      
      // Move to next question
      if (currentQuestionIndex < getFilteredGrades().length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        alert('All questions reviewed!');
        navigate(-1);
      }
    } catch (error) {
      console.error('Failed to reject grade:', error);
      alert('Failed to reject grade. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600">Loading submission...</p>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Submission not found</p>
        </div>
      </div>
    );
  }

  const filteredGrades = getFilteredGrades();
  const currentGrade = getCurrentGrade();

  if (filteredGrades.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Check className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No questions need review</h3>
          <p className="mt-1 text-sm text-gray-500">All grades have been reviewed or no questions are flagged</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Back to Results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manual Review</h1>
        <p className="mt-2 text-gray-600">
          {submission.studentName} ({submission.studentId}) - {submission.examTitle}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Question {currentQuestionIndex + 1} of {filteredGrades.length}
            {showOnlyFlagged && ' (Flagged Only)'}
          </span>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showOnlyFlagged}
              onChange={(e) => {
                setShowOnlyFlagged(e.target.checked);
                setCurrentQuestionIndex(0);
              }}
              className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Show only flagged questions
          </label>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / filteredGrades.length) * 100}%` }}
          />
        </div>
      </div>

      {currentGrade && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Student Answer */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Answer</h2>
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Question {currentGrade.questionNumber}:
              </div>
              <div className="text-gray-900 mb-4">{currentGrade.questionText}</div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Student's Response:</div>
                <div className="text-gray-900">{currentGrade.studentAnswer}</div>
              </div>
            </div>
          </div>

          {/* Expected Answer */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Expected Answer</h2>
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="text-gray-900">{currentGrade.expectedAnswer}</div>
            </div>
          </div>
        </div>
      )}

      {/* AI Grading Result */}
      {currentGrade && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">AI Grading Result</h2>
            {currentGrade.flaggedForReview && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Flagged for Review
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600">AI Grade</div>
              <div className="text-2xl font-bold text-gray-900">
                {currentGrade.aiGrade} / {currentGrade.maxPoints}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Confidence</div>
              <div className="text-2xl font-bold">
                <span className={`${
                  currentGrade.confidence >= 0.8 ? 'text-green-600' :
                  currentGrade.confidence >= 0.6 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {Math.round(currentGrade.confidence * 100)}%
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Percentage</div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.round((currentGrade.aiGrade / currentGrade.maxPoints) * 100)}%
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-md p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">AI Explanation:</div>
            <div className="text-gray-900">{currentGrade.explanation}</div>
          </div>

          {currentGrade.manualOverride && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="text-sm font-medium text-blue-900 mb-2">Manual Override Applied</div>
              <div className="text-sm text-blue-800">
                Grade: {currentGrade.manualOverride.grade} / {currentGrade.maxPoints}
              </div>
              <div className="text-sm text-blue-800">
                Reason: {currentGrade.manualOverride.reason}
              </div>
              <div className="text-xs text-blue-600 mt-2">
                Reviewed by {currentGrade.manualOverride.reviewedBy} on{' '}
                {new Date(currentGrade.manualOverride.reviewedAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grade Modification */}
      {currentGrade && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Grade Modification</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit Grade
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Grade (max: {currentGrade.maxPoints})
                </label>
                <input
                  type="number"
                  min="0"
                  max={currentGrade.maxPoints}
                  step="0.5"
                  value={editedGrade}
                  onChange={(e) => setEditedGrade(parseFloat(e.target.value))}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Modification *
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why you're modifying this grade..."
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleModify}
                  disabled={saving || !editReason.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300"
                >
                  Save Modification
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedGrade(currentGrade.manualOverride?.grade ?? currentGrade.aiGrade);
                    setEditReason('');
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Click "Edit Grade" to modify the AI-assigned grade, or use the action buttons below.
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </button>
          <button
            onClick={() => setCurrentQuestionIndex(Math.min(filteredGrades.length - 1, currentQuestionIndex + 1))}
            disabled={currentQuestionIndex === filteredGrades.length - 1}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-1" />
            Approve
          </button>
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Back to Results
        </button>
      </div>
    </div>
  );
}
