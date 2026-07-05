// Multi-Tenant Document Platform - Shared Types

export interface Customer {
  customerId: string;
  sk: string; // CUSTOMER#METADATA
  companyName: string;
  subscriptionTier: 'FREE' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  createdAt: string;
  settings: CustomerSettings;
  billingInfo?: BillingInfo;
  contactInfo: ContactInfo;
}

export interface CustomerSettings {
  maxDocumentsPerMonth: number;
  maxUsers: number;
  apiEnabled: boolean;
  webhooksEnabled: boolean;
  mlEnabled: boolean;
  languageSupport: ('en' | 'fr' | 'ar')[];
}

export interface BillingInfo {
  email: string;
  address?: string;
  paymentMethod?: string;
}

export interface ContactInfo {
  email: string;
  phone?: string;
  address?: string;
}

export interface User {
  customerId: string;
  sk: string; // USER#{userId}
  userId: string; // Cognito sub
  email: string;
  role: 'ADMIN' | 'USER' | 'API';
  permissions: string[];
  createdAt: string;
  lastLoginAt?: string;
}

export interface DocumentType {
  customerId: string;
  sk: string; // DOCTYPE#{documentTypeId}
  documentTypeId: string;
  name: string;
  description: string;
  schema: DocumentSchema;
  processingPipeline: ProcessingStep[];
  outputFormat: 'JSON' | 'CSV' | 'XML';
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSchema {
  fields: FieldDefinition[];
}

export interface FieldDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'table' | 'checkbox' | 'signature';
  required: boolean;
  validation?: ValidationRule;
  extractionRules?: ExtractionRule;
  calculated?: string; // Formula for calculated fields
}

export interface ValidationRule {
  pattern?: string; // Regex pattern
  min?: number;
  max?: number;
  format?: string; // Date format, etc.
  custom?: string; // Custom validation function
}

export interface ExtractionRule {
  method: 'textract_kvp' | 'textract_table' | 'regex' | 'bounding_box' | 'ml' | 'custom';
  keywords?: string[];
  pattern?: string;
  boundingBox?: BoundingBox;
  tableIndex?: number;
  confidence?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ProcessingStep = 'preprocess' | 'extract' | 'validate' | 'postprocess';

export interface Template {
  customerId: string;
  sk: string; // TEMPLATE#{templateId}
  templateId: string;
  documentTypeId: string;
  name: string;
  version: number;
  config: TemplateConfig;
  trainingData?: TrainingData[];
  performance?: TemplatePerformance;
  isActive: boolean;
  createdAt: string;
}

export interface TemplateConfig {
  fields: TemplateField[];
}

export interface TemplateField {
  fieldName: string;
  extractionMethod: 'textract' | 'regex' | 'ml';
  boundingBox?: BoundingBox;
  keywords?: string[];
  pattern?: string;
  confidence: number;
}

export interface TrainingData {
  documentId: string;
  groundTruth: Record<string, any>;
}

export interface TemplatePerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface Document {
  customerId: string;
  sk: string; // DOC#{uploadedAt}#{documentId}
  documentId: string;
  documentTypeId: string;
  templateId?: string;
  fileName: string;
  fileType: string;
  s3Key: string;
  language: 'en' | 'fr' | 'ar';
  status: 'UPLOADED' | 'PROCESSING' | 'REVIEW_REQUIRED' | 'COMPLETED' | 'FAILED';
  uploadedBy: string;
  uploadedAt: string;
  processedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  extractedData?: Record<string, any>;
  rawOcrData?: any;
  confidence?: ConfidenceScores;
  validationErrors?: ValidationError[];
  metadata?: Record<string, any>;
  processingMethod?: 'RULE_BASED' | 'ML_ENHANCED';
  mlModelVersion?: string;
  // GSI attributes
  customerStatus?: string; // customerId#status
  customerDocType?: string; // customerId#documentTypeId
}

export interface ConfidenceScores {
  overall: number;
  fields: Record<string, number>;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ExtractionJob {
  customerId: string;
  sk: string; // JOB#{jobId}
  jobId: string;
  documentId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  textractJobId?: string;
  error?: string;
  retryCount: number;
  ttl: number; // Unix timestamp for TTL
}

export interface Webhook {
  customerId: string;
  sk: string; // WEBHOOK#{webhookId}
  webhookId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

export type WebhookEvent = 
  | 'document.uploaded'
  | 'document.processing'
  | 'document.completed'
  | 'document.failed'
  | 'document.review_required'
  | 'document.reviewed';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  customerId: string;
  data: any;
  signature: string;
}

// API Request/Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  total?: number;
}

// Lambda Event Context
export interface AuthContext {
  customerId: string;
  userId: string;
  role: 'ADMIN' | 'USER' | 'API';
  email: string;
}
