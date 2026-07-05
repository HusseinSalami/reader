import axios from 'axios';
import { config } from '../config';
import { authService } from './auth';

const api = axios.create({
  baseURL: config.apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = authService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface DocumentType {
  documentTypeId: string;
  customerId: string;
  name: string;
  description: string;
  schema: {
    fields: Array<{
      fieldId: string;
      name: string;
      dataType: 'text' | 'number' | 'date' | 'boolean' | 'table' | 'array';
      required: boolean;
      validationRules?: Array<{
        type: string;
        params: Record<string, any>;
      }>;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  templateId: string;
  customerId: string;
  documentTypeId: string;
  name: string;
  description?: string;
  rules: Array<{
    ruleId: string;
    fieldId: string;
    method: 'textract_kv' | 'regex' | 'table';
    params: Record<string, any>;
  }>;
  aiEnhanced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  documentId: string;
  customerId: string;
  documentTypeId?: string;
  templateId?: string;
  filename: string;
  s3Key: string;
  s3Bucket: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review';
  uploadedAt: string;
  processedAt?: string;
  language?: string;
  extractedData?: {
    fields: Record<string, {
      fieldId: string;
      value: any;
      confidence: number;
      source: 'textract' | 'bedrock' | 'manual';
      needsReview: boolean;
      corrected: boolean;
    }>;
  };
  validationErrors?: Array<{
    fieldId: string;
    fieldName: string;
    rule: string;
    message: any;
    value: any;
  }>;
  // Legacy fields for backward compatibility
  version?: number;
  userId?: string;
  fileName?: string;
  fileType?: string;
  extractedText?: string;
  metadata?: any;
  wordCount?: number;
  pageCount?: number;
  errorMessage?: string;
  downloadUrl?: string;
}

// Document Type API
export const documentTypeApi = {
  async list(limit = 50): Promise<{ items: DocumentType[]; nextToken?: string }> {
    const response = await api.get('/v1/document-types', { params: { limit } });
    return response.data.data;
  },

  async get(documentTypeId: string): Promise<DocumentType> {
    const response = await api.get(`/v1/document-types/${documentTypeId}`);
    return response.data.data;
  },

  async create(data: {
    name: string;
    description: string;
    schema: DocumentType['schema'];
    aiEnhanced?: boolean;
  }): Promise<DocumentType> {
    const response = await api.post('/v1/document-types', data);
    return response.data.data;
  },

  async update(documentTypeId: string, data: Partial<DocumentType>): Promise<DocumentType> {
    const response = await api.put(`/v1/document-types/${documentTypeId}`, data);
    return response.data.data;
  },

  async delete(documentTypeId: string): Promise<void> {
    await api.delete(`/v1/document-types/${documentTypeId}`);
  },
};

// Template API
export const templateApi = {
  async list(documentTypeId?: string, limit = 50): Promise<{ items: Template[]; nextToken?: string }> {
    const params: any = { limit };
    if (documentTypeId) params.documentTypeId = documentTypeId;
    const response = await api.get('/v1/templates', { params });
    return response.data.data;
  },

  async get(templateId: string): Promise<Template> {
    const response = await api.get(`/v1/templates/${templateId}`);
    return response.data.data;
  },

  async create(data: {
    name: string;
    description?: string;
    documentTypeId: string;
    rules: Template['rules'];
    aiEnhanced?: boolean;
  }): Promise<Template> {
    const response = await api.post('/v1/templates', data);
    return response.data.data;
  },

  async update(templateId: string, data: Partial<Template>): Promise<Template> {
    const response = await api.put(`/v1/templates/${templateId}`, data);
    return response.data.data;
  },

  async delete(templateId: string): Promise<void> {
    await api.delete(`/v1/templates/${templateId}`);
  },

  async generateFromExamples(data: {
    documentTypeId: string;
    documentTypeName: string;
    documentTypeSchema: DocumentType['schema'];
    sampleDocuments: Array<{ filename: string; fileContent: string }>;
    templateName?: string;
    templateDescription?: string;
  }): Promise<{
    success: boolean;
    template: any;
    usage: {
      inputTokens: number;
      outputTokens: number;
      cost: number;
      monthlyUsage: number;
      remainingBudget: number;
    };
  }> {
    const response = await api.post('/v1/templates/generate', data);
    return response.data;
  },
};

// Document API (Phase 2)
export const documentApi = {
  // New Phase 2 upload with processing
  async uploadNew(data: {
    documentTypeId: string;
    templateId: string;
    filename: string;
    fileContent: string; // base64
    language?: string;
  }): Promise<{ documentId: string; s3Key: string; uploadedAt: string }> {
    const response = await api.post('/v1/documents/upload-new', data);
    return response.data.data;
  },

  async list(params?: {
    status?: string;
    limit?: number;
    nextToken?: string;
  }): Promise<{ items: Document[]; nextToken?: string }> {
    const response = await api.get('/v1/documents', { params });
    return response.data.data;
  },

  async get(documentId: string): Promise<Document> {
    const response = await api.get(`/v1/documents/${documentId}`);
    return response.data.data;
  },

  async review(documentId: string, extractedData: Document['extractedData']): Promise<Document> {
    const response = await api.put(`/v1/documents/${documentId}/review`, { extractedData });
    return response.data.data;
  },

  async approve(documentId: string): Promise<Document> {
    const response = await api.post(`/v1/documents/${documentId}/approve`);
    return response.data.data;
  },

  async reject(documentId: string, reason: string): Promise<Document> {
    const response = await api.post(`/v1/documents/${documentId}/reject`, { reason });
    return response.data.data;
  },

  // Legacy Phase 1 methods (for backward compatibility)
  async getUploadUrl(fileName: string, fileType: string, userId?: string, metadata?: any) {
    const response = await api.post('/v1/documents/upload', {
      fileName,
      fileType,
      userId,
      metadata,
    });
    return response.data.data; // Unwrap the data property
  },

  async uploadFile(uploadUrl: string, file: File) {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
    });
  },

  async searchDocuments(query: string, limit?: number) {
    const response = await api.get('/documents/search', {
      params: { q: query, limit },
    });
    return response.data;
  },
};

export default api;
