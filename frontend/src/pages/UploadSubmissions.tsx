import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, FileText, Users, AlertCircle } from 'lucide-react';

interface Exam {
  examId: string;
  title: string;
}

export default function UploadSubmissions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedExamId = searchParams.get('examId');
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(preselectedExamId || '');
  const [uploadMode, setUploadMode] = useState<'single' | 'batch'>('single');
  
  // Single upload
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  
  // Batch upload
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [csvMapping, setCsvMapping] = useState<File | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<any[]>([]);

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await examApi.listExams();
      // setExams(response);
      setExams([]);
    } catch (error) {
      console.error('Failed to load exams:', error);
    }
  };

  const handleSingleUpload = async () => {
    if (!selectedExamId || !singleFile || !studentName || !studentId) {
      alert('Please fill in all required fields');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // TODO: Replace with actual API call
      // await submissionApi.uploadSubmission({
      //   examId: selectedExamId,
      //   file: singleFile,
      //   studentName,
      //   studentId
      // });

      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      alert('Submission uploaded successfully!');
      navigate(`/advanced/exams/${selectedExamId}/results`);
    } catch (error) {
      console.error('Failed to upload submission:', error);
      alert('Failed to upload submission. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleBatchUpload = async () => {
    if (!selectedExamId || batchFiles.length === 0 || !csvMapping) {
      alert('Please select exam, files, and CSV mapping');
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadResults([]);

    try {
      // TODO: Replace with actual API call
      // const response = await submissionApi.batchUpload({
      //   examId: selectedExamId,
      //   files: batchFiles,
      //   mapping: csvMapping
      // });

      // Simulate batch processing
      const results = [];
      for (let i = 0; i < batchFiles.length; i++) {
        setProgress(Math.round(((i + 1) / batchFiles.length) * 100));
        results.push({
          filename: batchFiles[i].name,
          status: 'success',
          studentName: `Student ${i + 1}`
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setUploadResults(results);
      alert(`Successfully uploaded ${batchFiles.length} submissions!`);
    } catch (error) {
      console.error('Failed to batch upload:', error);
      alert('Failed to upload submissions. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload Submissions</h1>
        <p className="mt-2 text-gray-600">Upload student exam submissions for grading</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        {/* Exam Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Exam *
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            disabled={!!preselectedExamId}
          >
            <option value="">Choose an exam...</option>
            {exams.map((exam) => (
              <option key={exam.examId} value={exam.examId}>
                {exam.title}
              </option>
            ))}
          </select>
        </div>

        {/* Upload Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Mode
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setUploadMode('single')}
              className={`flex-1 p-4 border-2 rounded-lg ${
                uploadMode === 'single'
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <FileText className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
              <div className="font-medium">Single Upload</div>
              <div className="text-sm text-gray-600">Upload one submission at a time</div>
            </button>
            <button
              onClick={() => setUploadMode('batch')}
              className={`flex-1 p-4 border-2 rounded-lg ${
                uploadMode === 'batch'
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Users className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
              <div className="font-medium">Batch Upload</div>
              <div className="text-sm text-gray-600">Upload multiple submissions</div>
            </button>
          </div>
        </div>

        {/* Single Upload Form */}
        {uploadMode === 'single' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student Name *
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter student name"
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student ID *
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Enter student ID"
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Submission File *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <div className="mt-2">
                  <label className="cursor-pointer">
                    <span className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                      Choose file
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setSingleFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    PDF, PNG, or JPG up to 10MB
                  </p>
                </div>
                {singleFile && (
                  <p className="mt-2 text-sm text-gray-700">
                    Selected: {singleFile.name}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleSingleUpload}
              disabled={uploading || !selectedExamId || !singleFile || !studentName || !studentId}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload Submission'}
            </button>
          </div>
        )}

        {/* Batch Upload Form */}
        {uploadMode === 'batch' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-blue-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Batch Upload Instructions</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Upload a CSV file with student information (name, ID, filename)</li>
                      <li>Upload all submission files</li>
                      <li>Files will be matched to students using the CSV mapping</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV Mapping File *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <label className="cursor-pointer">
                  <span className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    Choose CSV file
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={(e) => setCsvMapping(e.target.files?.[0] || null)}
                  />
                </label>
                {csvMapping && (
                  <p className="mt-2 text-sm text-gray-700">
                    Selected: {csvMapping.name}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Submission Files *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <div className="mt-2">
                  <label className="cursor-pointer">
                    <span className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                      Choose files
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                      multiple
                      onChange={(e) => setBatchFiles(Array.from(e.target.files || []))}
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Select multiple PDF, PNG, or JPG files
                  </p>
                </div>
                {batchFiles.length > 0 && (
                  <p className="mt-2 text-sm text-gray-700">
                    Selected: {batchFiles.length} files
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleBatchUpload}
              disabled={uploading || !selectedExamId || batchFiles.length === 0 || !csvMapping}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : `Upload ${batchFiles.length} Submissions`}
            </button>
          </div>
        )}

        {/* Progress Indicator */}
        {uploading && (
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Processing...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600 text-center">
              {uploadMode === 'single' ? 'Uploading and processing submission...' : 'Processing batch upload...'}
            </p>
          </div>
        )}

        {/* Batch Upload Results */}
        {uploadResults.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Results</h3>
            <div className="space-y-2">
              {uploadResults.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{result.filename}</p>
                      <p className="text-xs text-gray-600">{result.studentName}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    result.status === 'success'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => navigate('/advanced')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
          {uploadResults.length > 0 && (
            <button
              onClick={() => navigate(`/advanced/exams/${selectedExamId}/results`)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              View Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
