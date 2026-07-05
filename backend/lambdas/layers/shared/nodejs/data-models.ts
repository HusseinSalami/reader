// Document Type & Template Management - Data Models
// Phase 2: Multi-Tenant Document Platform

// ========================================
// Field and Schema Types
// ========================================

export type FieldDataType = "text" | "number" | "date" | "boolean" | "table" | "array";
export type ValidationType = "required" | "format" | "range" | "regex" | "dateFormat";
export type ExtractionMethod = "textract_kv" | "regex" | "bbox" | "table";
export type ExtractionSource = "textract" | "bedrock" | "manual";
export type Language = "en" | "fr" | "ar";
export type DocumentStatus = "uploaded" | "processing" | "completed" | "failed" | "reviewed" | "approved";

export interface TableConfig {
  columns: TableColumn[];
}

export interface TableColumn {
  name: string;
  dataType: FieldDataType;
}

export interface ValidationRule {
  type: ValidationType;
  params: Record<string, any>;
}

export interface Field {
  fieldId: string;
  name: string;
  dataType: FieldDataType;
  description?: string;
  required: boolean;
  validationRules: ValidationRule[];
  tableConfig?: TableConfig;
}

export interface ExtractionSchema {
  fields: Field[];
}

// ========================================
// Document Type
// ========================================

export interface DocumentType {
  PK: string;              // "CUSTOMER#{customerId}"
  SK: string;              // "DOCTYPE#{documentTypeId}"
  documentTypeId: string;
  customerId: string;
  name: string;
  description: string;
  schema: ExtractionSchema;
  createdAt: string;
  updatedAt: string;
}

// ========================================
// Extraction Rules and Template
// ========================================

export type ExtractionParams = 
  | TextractKVParams 
  | RegexParams 
  | BoundingBoxParams 
  | TableParams;

export interface TextractKVParams {
  keyPattern: string;
  confidence?: number;
}

export interface RegexParams {
  pattern: string;
  captureGroup?: number;
  flags?: string;
}

export interface BoundingBoxParams {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface TableParams {
  tableIndex: number;
  columnMapping: Record<string, string>;
}

export interface ExtractionRule {
  ruleId: string;
  fieldId: string;
  method: ExtractionMethod;
  params: ExtractionParams;
}

export interface Template {
  PK: string;              // "CUSTOMER#{customerId}"
  SK: string;              // "TEMPLATE#{templateId}"
  GSI1PK?: string;         // "DOCTYPE#{documentTypeId}"
  GSI1SK?: string;         // "TEMPLATE#{templateId}"
  templateId: string;
  customerId: string;
  documentTypeId: string;
  name: string;
  description?: string;
  rules: ExtractionRule[];
  aiEnhanced: boolean;
  createdAt: string;
  updatedAt: string;
}

// ========================================
// Document and Extracted Data
// ========================================

export interface FieldCorrection {
  originalValue: any;
  correctedValue: any;
  correctedAt: string;
  correctedBy: string;
}

export interface ExtractedField {
  fieldId: string;
  value: any;
  confidence?: number;
  source: ExtractionSource;
  corrected: boolean;
  correctionHistory?: FieldCorrection[];
}

export interface ExtractedData {
  fields: Record<string, ExtractedField>;
}

export interface ValidationError {
  fieldId: string;
  fieldName: string;
  value: any;
  rule: ValidationType;
  message: string;
}

export interface Document {
  PK: string;              // "CUSTOMER#{customerId}"
  SK: string;              // "DOCUMENT#{documentId}"
  GSI2PK?: string;         // "CUSTOMER#{customerId}"
  GSI2SK?: string;         // "STATUS#{status}#DOCUMENT#{documentId}"
  documentId: string;
  customerId: string;
  documentTypeId: string;
  templateId: string;
  filename: string;
  fileSize: number;
  s3Key: string;
  s3Bucket: string;
  language: Language;
  status: DocumentStatus;
  uploadedAt: string;
  processedAt?: string;
  extractedData?: ExtractedData;
  validationErrors?: ValidationError[];
  reviewedAt?: string;
  reviewedBy?: string;
}

// ========================================
// Textract Integration Types
// ========================================

export interface KeyValuePair {
  key: string;
  value: string;
  confidence: number;
}

export interface TableCell {
  text: string;
  rowIndex: number;
  columnIndex: number;
  confidence: number;
}

export interface TableRow {
  cells: TableCell[];
}

export interface Table {
  rows: TableRow[];
  confidence: number;
}

export interface TextractOutput {
  text: string;
  keyValuePairs: KeyValuePair[];
  tables: Table[];
  confidence: number;
}
