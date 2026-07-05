export interface Tenant {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  settings: TenantSettings;
  created_at: string;
}

export interface TenantSettings {
  max_documents_per_month: number;
  max_file_size_mb: number;
  ai_model: 'haiku' | 'sonnet';
}

export interface Document {
  id: string;
  tenant_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  document_type: DocumentType;
  status: DocumentStatus;
  extracted_data: ExtractedData | null;
  confidence: number | null;
  language: string | null;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentType =
  | 'invoice'
  | 'receipt'
  | 'credit_note'
  | 'purchase_order'
  | 'delivery_note'
  | 'bank_statement'
  | 'expense_report'
  | 'contract'
  | 'other';

export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'extracted'
  | 'review_required'
  | 'approved'
  | 'rejected'
  | 'failed';

export interface ExtractedData {
  vendor?: VendorInfo;
  document_number?: string;
  date?: string;
  due_date?: string;
  currency?: string;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  total?: number;
  line_items?: LineItem[];
  payment_terms?: string;
  notes?: string;
  raw_text?: string;
  custom_fields?: Record<string, unknown>;
}

export interface VendorInfo {
  name?: string;
  address?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  amount: number;
  tax_rate?: number;
  code?: string;
}

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  document_ids?: string[];
  date_from?: string;
  date_to?: string;
  include_images?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  document_id: string;
  extracted_data: ExtractedData | null;
  confidence: number;
  processing_time_ms: number;
  tokens_used: { input: number; output: number };
  cost: number;
  error?: string;
}

export interface AuthPayload {
  tenant_id: string;
  email: string;
  role: 'admin' | 'user';
}
