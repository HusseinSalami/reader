import { FastifyInstance } from 'fastify';
import { supabase } from '../db/client.js';
import { getTenantId } from '../middleware/auth.js';

export async function searchRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Full-text search across documents
  app.get('/', async (request) => {
    const tenantId = getTenantId(request);
    const {
      q,
      type,
      status,
      date_from,
      date_to,
      page = '1',
      limit = '20',
    } = request.query as Record<string, string>;

    if (!q || q.trim().length === 0) {
      return { results: [], total: 0, page: 1, limit: 20 };
    }

    const searchTerm = `%${q.trim()}%`;
    const offset = (+page - 1) * +limit;

    // Use Supabase's PostgREST .or() with ILIKE for simplicity
    let query = supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .or(
        `file_name.ilike.${searchTerm},` +
        `extracted_data->vendor->>name.ilike.${searchTerm},` +
        `extracted_data->>document_number.ilike.${searchTerm},` +
        `extracted_data->>notes.ilike.${searchTerm}`
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + +limit - 1);

    if (type) query = query.eq('document_type', type);
    if (status) query = query.eq('status', status);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    const { data, count, error } = await query;

    if (error) {
      return { results: [], total: 0, page: +page, limit: +limit };
    }

    // Highlight matching fields
    const results = (data || []).map((doc) => {
      const highlights: string[] = [];
      const lowerQ = q.toLowerCase();

      if (doc.file_name?.toLowerCase().includes(lowerQ)) {
        highlights.push(`file_name: ${doc.file_name}`);
      }
      if (doc.extracted_data?.vendor?.name?.toLowerCase().includes(lowerQ)) {
        highlights.push(`vendor: ${doc.extracted_data.vendor.name}`);
      }
      if (doc.extracted_data?.document_number?.toLowerCase().includes(lowerQ)) {
        highlights.push(`document_number: ${doc.extracted_data.document_number}`);
      }
      if (doc.extracted_data?.notes?.toLowerCase().includes(lowerQ)) {
        highlights.push(`notes: ${doc.extracted_data.notes}`);
      }

      return { ...doc, highlights };
    });

    return { results, total: count, page: +page, limit: +limit };
  });
}
