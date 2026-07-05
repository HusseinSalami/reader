import { FastifyInstance } from 'fastify';
import { supabase } from '../db/client.js';
import { getTenantId } from '../middleware/auth.js';
import { generateInvoicePdf } from '../services/pdf-export.js';
import { generateDocumentsExcel, generateDocumentsCsv } from '../services/excel-export.js';

export async function exportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Export single document as PDF
  app.get('/pdf/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };

    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!doc || !doc.extracted_data) {
      return reply.status(404).send({ error: 'Document not found or not yet processed' });
    }

    const pdf = generateInvoicePdf(doc);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${doc.file_name.replace(/\.[^.]+$/, '')}.pdf"`);
    return reply.send(pdf);
  });

  // Export documents as Excel
  app.get('/excel', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { status, type, date_from, date_to } = request.query as Record<string, string>;

    let query = supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .not('extracted_data', 'is', null)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('document_type', type);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    const { data: documents } = await query;
    if (!documents || documents.length === 0) {
      return reply.status(404).send({ error: 'No documents found' });
    }

    const excel = generateDocumentsExcel(documents);

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename="documents-export.xlsx"');
    return reply.send(excel);
  });

  // Export documents as CSV
  app.get('/csv', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { status, type, date_from, date_to } = request.query as Record<string, string>;

    let query = supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .not('extracted_data', 'is', null)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('document_type', type);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    const { data: documents } = await query;
    if (!documents || documents.length === 0) {
      return reply.status(404).send({ error: 'No documents found' });
    }

    const csv = generateDocumentsCsv(documents);

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="documents-export.csv"');
    return reply.send(csv);
  });

  // Usage stats
  app.get('/usage', async (request) => {
    const tenantId = getTenantId(request);
    const { month } = request.query as { month?: string };
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const { data } = await supabase
      .from('usage')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month', targetMonth)
      .single();

    return data || {
      documents_processed: 0,
      tokens_input: 0,
      tokens_output: 0,
      total_cost: 0,
      month: targetMonth,
    };
  });
}
