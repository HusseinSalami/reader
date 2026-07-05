import axios from 'axios';
import { authService } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = authService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Exam Management
export const examApi = {
  async listExams() {
    const response = await api.get('/exams');
    return response.data;
  },

  async getExam(examId: string) {
    const response = await api.get(`/exams/${examId}`);
    return response.data;
  },

  async createExam(data: {
    title: string;
    teacherId: string;
    questionnaireUrl: string;
    answerKeyUrl: string;
  }) {
    const response = await api.post('/v1/exams', data);
    return response.data;
  },

  async updateQuestions(examId: string, questions: any[]) {
    const response = await api.put(`/exams/${examId}/questions`, { questions });
    return response.data;
  },

  async deleteExam(examId: string) {
    const response = await api.delete(`/exams/${examId}`);
    return response.data;
  },

  async uploadQuestionnaire(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/exams/upload-questionnaire', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async uploadAnswerKey(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/exams/upload-answer-key', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// Submission Management
export const submissionApi = {
  async listSubmissions(examId: string) {
    const response = await api.get(`/exams/${examId}/submissions`);
    return response.data;
  },

  async getSubmission(submissionId: string) {
    const response = await api.get(`/submissions/${submissionId}`);
    return response.data;
  },

  async uploadSubmission(data: {
    examId: string;
    file: File;
    studentName: string;
    studentId: string;
  }) {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('studentName', data.studentName);
    formData.append('studentId', data.studentId);
    
    const response = await api.post(`/exams/${data.examId}/submissions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async batchUpload(data: {
    examId: string;
    files: File[];
    mapping: File;
  }) {
    const formData = new FormData();
    data.files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('mapping', data.mapping);
    
    const response = await api.post(`/exams/${data.examId}/submissions/batch`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async updateGrade(submissionId: string, questionNumber: number, data: {
    grade: number;
    reason: string;
  }) {
    const response = await api.put(
      `/submissions/${submissionId}/grades/${questionNumber}`,
      data
    );
    return response.data;
  },

  async approveGrade(submissionId: string, questionNumber: number) {
    const response = await api.post(
      `/submissions/${submissionId}/grades/${questionNumber}/approve`
    );
    return response.data;
  },

  async rejectGrade(submissionId: string, questionNumber: number, reason: string) {
    const response = await api.post(
      `/submissions/${submissionId}/grades/${questionNumber}/reject`,
      { reason }
    );
    return response.data;
  },

  async finalizeSubmission(submissionId: string) {
    const response = await api.post(`/submissions/${submissionId}/finalize`);
    return response.data;
  },

  async bulkApprove(examId: string, submissionIds: string[]) {
    const response = await api.post(`/exams/${examId}/bulk-approve`, {
      submissionIds,
    });
    return response.data;
  },
};

// Export Service
export const exportApi = {
  async exportCSV(examId: string) {
    const response = await api.get(`/exams/${examId}/export/csv`);
    return response.data.url; // Pre-signed S3 URL
  },

  async exportExcel(examId: string) {
    const response = await api.get(`/exams/${examId}/export/excel`);
    return response.data.url; // Pre-signed S3 URL
  },
};

// WebSocket for real-time updates (optional)
export const createSubmissionWebSocket = (_examId: string, _onUpdate: (data: any) => void) => {
  // TODO: Implement WebSocket connection for real-time batch processing updates
  // const ws = new WebSocket(`${API_BASE_URL.replace('http', 'ws')}/submissions/${examId}/updates`);
  // ws.onmessage = (event) => onUpdate(JSON.parse(event.data));
  // return ws;
  
  // For now, return a mock object
  return {
    close: () => {},
  };
};
