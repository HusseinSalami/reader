import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Upload from './pages/Upload';
import Documents from './pages/Documents';
import DocumentDetail from './pages/DocumentDetail';
import DocumentTypes from './pages/DocumentTypes';
import Templates from './pages/Templates';
import Search from './pages/Search';
import ExamGradingDashboard from './pages/ExamGradingDashboard';
import CreateExamWizard from './pages/CreateExamWizard';
import UploadSubmissions from './pages/UploadSubmissions';
import GradingResults from './pages/GradingResults';
import ManualReview from './pages/ManualReview';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes - No Layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected routes - With Layout */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Layout>
                <Upload />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <Layout>
                <Documents />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/document-types"
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentTypes />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <Layout>
                <Templates />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Layout>
                <Search />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advanced"
          element={
            <ProtectedRoute>
              <Layout>
                <ExamGradingDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advanced/create-exam"
          element={
            <ProtectedRoute>
              <Layout>
                <CreateExamWizard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advanced/upload-submissions"
          element={
            <ProtectedRoute>
              <Layout>
                <UploadSubmissions />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advanced/exams/:examId/results"
          element={
            <ProtectedRoute>
              <Layout>
                <GradingResults />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advanced/submissions/:submissionId"
          element={
            <ProtectedRoute>
              <Layout>
                <ManualReview />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
