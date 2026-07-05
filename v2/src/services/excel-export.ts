import * as XLSX from 'xlsx';
import { Document } from '../types/index.js';

export function generateDocumentsExcel(documents: Document[]): Buffer {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = documents.map(doc => ({
    'Document ID': doc.id,
    'File Name': doc.file_name,
    'Type': doc.document_type,
    'Status': doc.status,
    'Vendor': doc.extracted_data?.vendor?.name || '',
    'Document #': doc.extracted_data?.document_number || '',
    'Date': doc.extracted_data?.date || '',
    'Currency': doc.extracted_data?.currency || '',
    'Subtotal': doc.extracted_data?.subtotal ?? '',
    'Tax': doc.extracted_data?.tax_amount ?? '',
    'Total': doc.extracted_data?.total ?? '',
    'Confidence': doc.confidence ? `${(doc.confidence * 100).toFixed(0)}%` : '',
    'Uploaded': doc.created_at,
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Documents');

  // Line items sheet (all documents combined)
  const lineItemsData: any[] = [];
  for (const doc of documents) {
    if (doc.extracted_data?.line_items) {
      for (const item of doc.extracted_data.line_items) {
        lineItemsData.push({
          'Document #': doc.extracted_data.document_number || doc.file_name,
          'Vendor': doc.extracted_data.vendor?.name || '',
          'Date': doc.extracted_data.date || '',
          'Item Description': item.description,
          'Quantity': item.quantity ?? 1,
          'Unit Price': item.unit_price ?? '',
          'Amount': item.amount,
          'Tax Rate': item.tax_rate ? `${item.tax_rate}%` : '',
          'Code': item.code || '',
        });
      }
    }
  }

  if (lineItemsData.length > 0) {
    const lineItemsSheet = XLSX.utils.json_to_sheet(lineItemsData);
    XLSX.utils.book_append_sheet(wb, lineItemsSheet, 'Line Items');
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buffer);
}

export function generateDocumentsCsv(documents: Document[]): string {
  const rows = documents.map(doc => ({
    document_id: doc.id,
    file_name: doc.file_name,
    type: doc.document_type,
    status: doc.status,
    vendor: doc.extracted_data?.vendor?.name || '',
    document_number: doc.extracted_data?.document_number || '',
    date: doc.extracted_data?.date || '',
    currency: doc.extracted_data?.currency || '',
    subtotal: doc.extracted_data?.subtotal ?? '',
    tax: doc.extracted_data?.tax_amount ?? '',
    total: doc.extracted_data?.total ?? '',
    confidence: doc.confidence ?? '',
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  return XLSX.utils.sheet_to_csv(sheet);
}
