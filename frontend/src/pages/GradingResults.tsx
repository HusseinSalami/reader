import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Eye, CheckCircle, AlertTriangle, Clock, Filter } from 'lucide-react';

interface Submission {
  submissionId: string;
  studentName: string;
  studentId: string;
  totalScore: number;
  maxScore: number;
  averageConfidence: number;
  status: 'GRADED' | 'REVIEW_REQUIRED' | 'FINALIZED' | 'PROCESSING';
  submittedAt: string;
  flaggedQuestionsCount: number;
}

export default function GradingResults() {
  const { examId } = useParams();
  const navigate = useNavigate();
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'score' | 'confidence' | 'name'>('score');
  const [selectedSubmission] = useState<string | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, [examId]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await submissionApi.listSubmissions(examId);
      // setSubmissions(response);
      
      // Mock data
      setSubmissions([
        {
          submissionId: '1',
          studentName: 'John Doe',
          studentId: 'S001',
          totalScore: 85,
          maxScore: 100,
          averageConfidence: 0.92,
          status: 'GRADED',
          submittedAt: new Date().toISOString(),
          flaggedQuestionsCount: 0
        },
        {
          submissionId: '2',
          studentName: 'Jane Smith',
          studentId: 'S002',
          totalScore: 72,
          maxScore: 100,
          averageConfidence: 0.65,
          status: 'REVIEW_REQUIRED',
          submittedAt: new Date().toISOString(),
          flaggedQuestionsCount: 3
        }
      ]);
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      // TODO: Replace with actual API call
      // const url = await exportApi.exportResults(examId, format);
      // window.open(url, '_blank');
      alert(`Exporting to ${format.toUpperCase()}...`);
    } catch (error) {
      console.error('Failed to export:', error);
      alert('Failed to export results. Please try again.');
    }
  };

  const handleBulkApprove = async () => {
    const highConfidenceSubmissions = submissions.filter(
      s => s.averageConfidence >= 0.8 && s.status === 'GRADED'
    );
    
    if (highConfidenceSubmissions.length === 0) {
      alert('No high-confidence submissions to approve');
      return;
    }

    const confirmed = window.confirm(
      `This will approve and finalize ${highConfidenceSubmissions.length} submissions with confidence ≥80%. Continue?`
    );

    if (confirmed) {
      try {
        // TODO: Replace with actual API call
        // await submissionApi.bulkApprove(examId, highConfidenceSubmissions.map(s => s.submissionId));
        alert(`Successfully approved ${highConfidenceSubmissions.length} submissions!`);
        loadSubmissions();
      } catch (error) {
        console.error('Failed to bulk approve:', error);
        alert('Failed to approve submissions. Please try again.');
      }
    }
  };

  const filteredSubmissions = submissions
    .filter(s => filterStatus === 'ALL' || s.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.totalScore - a.totalScore;
        case 'confidence':
          return b.averageConfidence - a.averageConfidence;
        case 'name':
          return a.studentName.localeCompare(b.studentName);
        default:
          return 0;
      }
    });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'GRADED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'REVIEW_REQUIRED':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'FINALIZED':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'PROCESSING':
        return <Clock className="h-5 w-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const highConfidenceCount = submissions.filter(
    s => s.averageConfidence >= 0.8 && s.status === 'GRADED'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Grading Results</h1>
        <p className="mt-2 text-gray-600">Review and manage student submission grades</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Submissions</div>
          <div className="text-2xl font-bold text-gray-900">{submissions.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Graded</div>
          <div className="text-2xl font-bold text-green-600">
            {submissions.filter(s => s.status === 'GRADED' || s.status === 'FINALIZED').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Need Review</div>
          <div className="text-2xl font-bold text-yellow-600">
            {submissions.filter(s => s.status === 'REVIEW_REQUIRED').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Average Score</div>
          <div className="text-2xl font-bold text-indigo-600">
            {submissions.length > 0
              ? Math.round(submissions.reduce((sum, s) => sum + (s.totalScore / s.maxScore) * 100, 0) / submissions.length)
              : 0}%
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </button>
          {highConfidenceCount > 0 && (
            <button
              onClick={handleBulkApprove}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Bulk Approve ({highConfidenceCount})
            </button>
          )}
        </div>

        <div className="flex gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="ALL">All Status</option>
            <option value="GRADED">Graded</option>
            <option value="REVIEW_REQUIRED">Review Required</option>
            <option value="FINALIZED">Finalized</option>
            <option value="PROCESSING">Processing</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="score">Sort by Score</option>
            <option value="confidence">Sort by Confidence</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600">Loading results...</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Filter className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No submissions found</h3>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flagged
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSubmissions.map((submission) => (
                <tr
                  key={submission.submissionId}
                  className={`hover:bg-gray-50 ${
                    selectedSubmission === submission.submissionId ? 'bg-indigo-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(submission.status)}
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {submission.studentName}
                        </div>
                        <div className="text-sm text-gray-500">{submission.studentId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {submission.totalScore} / {submission.maxScore}
                    </div>
                    <div className="text-sm text-gray-500">
                      {Math.round((submission.totalScore / submission.maxScore) * 100)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getConfidenceColor(submission.averageConfidence)}`}>
                      {Math.round(submission.averageConfidence * 100)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      submission.status === 'FINALIZED' ? 'bg-blue-100 text-blue-800' :
                      submission.status === 'GRADED' ? 'bg-green-100 text-green-800' :
                      submission.status === 'REVIEW_REQUIRED' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {submission.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {submission.flaggedQuestionsCount > 0 ? (
                      <span className="text-yellow-600 font-medium">
                        {submission.flaggedQuestionsCount} questions
                      </span>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => navigate(`/advanced/submissions/${submission.submissionId}`)}
                      className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6">
        <button
          onClick={() => navigate('/advanced')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
