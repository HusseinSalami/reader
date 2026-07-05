import PDFDocument from 'pdfkit';
import { Document, ExtractedData, LineItem } from '../types/index.js';

export function generateInvoicePdf(document: Document): Buffer {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const data = document.extracted_data!;

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
  doc.moveDown(0.5);

  // Vendor info
  if (data.vendor?.name) {
    doc.fontSize(14).font('Helvetica-Bold').text(data.vendor.name);
    doc.fontSize(10).font('Helvetica');
    if (data.vendor.address) doc.text(data.vendor.address);
    if (data.vendor.email) doc.text(data.vendor.email);
    if (data.vendor.phone) doc.text(data.vendor.phone);
    if (data.vendor.tax_id) doc.text(`Tax ID: ${data.vendor.tax_id}`);
  }

  doc.moveDown();

  // Document details
  doc.fontSize(10).font('Helvetica');
  const detailsY = doc.y;
  if (data.document_number) doc.text(`Invoice #: ${data.document_number}`, 50, detailsY);
  if (data.date) doc.text(`Date: ${data.date}`, 50, detailsY + 15);
  if (data.due_date) doc.text(`Due Date: ${data.due_date}`, 50, detailsY + 30);
  if (data.payment_terms) doc.text(`Terms: ${data.payment_terms}`, 50, detailsY + 45);

  doc.moveDown(4);

  // Line items table
  if (data.line_items && data.line_items.length > 0) {
    const tableTop = doc.y;
    const col = { desc: 50, qty: 300, price: 370, amount: 450 };

    // Table header
    doc.font('Helvetica-Bold');
    doc.text('Description', col.desc, tableTop);
    doc.text('Qty', col.qty, tableTop);
    doc.text('Unit Price', col.price, tableTop);
    doc.text('Amount', col.amount, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Table rows
    doc.font('Helvetica');
    let rowY = tableTop + 25;
    for (const item of data.line_items) {
      doc.text(item.description || '', col.desc, rowY, { width: 240 });
      doc.text(item.quantity?.toString() || '1', col.qty, rowY);
      doc.text(formatCurrency(item.unit_price, data.currency), col.price, rowY);
      doc.text(formatCurrency(item.amount, data.currency), col.amount, rowY);
      rowY += 20;

      if (rowY > 700) {
        doc.addPage();
        rowY = 50;
      }
    }

    doc.moveTo(50, rowY).lineTo(545, rowY).stroke();
    rowY += 15;

    // Totals
    if (data.subtotal != null) {
      doc.text('Subtotal:', 370, rowY);
      doc.text(formatCurrency(data.subtotal, data.currency), 450, rowY);
      rowY += 18;
    }
    if (data.tax_amount != null) {
      const taxLabel = data.tax_rate ? `Tax (${data.tax_rate}%)` : 'Tax';
      doc.text(`${taxLabel}:`, 370, rowY);
      doc.text(formatCurrency(data.tax_amount, data.currency), 450, rowY);
      rowY += 18;
    }
    if (data.total != null) {
      doc.font('Helvetica-Bold');
      doc.text('Total:', 370, rowY);
      doc.text(formatCurrency(data.total, data.currency), 450, rowY);
    }
  }

  // Notes
  if (data.notes) {
    doc.moveDown(3);
    doc.fontSize(9).font('Helvetica').text(`Notes: ${data.notes}`, 50);
  }

  // Footer
  doc.fontSize(8).font('Helvetica')
    .text(`Generated from: ${document.file_name}`, 50, 750, { align: 'center' });

  doc.end();
  return Buffer.concat(chunks);
}

function formatCurrency(amount: number | undefined, currency?: string): string {
  if (amount == null) return '-';
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${sym}${amount.toFixed(2)}`;
}
