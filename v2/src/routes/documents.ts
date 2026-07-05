import { FastifyInstance, FastifyRequest } from 'fastify';
import { supabase } from '../db/client.js';
import { extractDocument } from '../services/ocr.js';
import { getTenantId } from '../middleware/auth.js';
import { fireWebhooks } from '../services/webhooks.js';
import sharp from 'sharp';
import { DocumentStatus, DocumentType } from '../types/index.js';

export async function documentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Upload and process a document
  app.post('/upload', async (request, reply) => {
    const tenantId = getTenantId(request);
    const file = await request.file();

    if (!file) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return reply.status(400).send({ error: 'Unsupported file type. Use JPEG, PNG, WebP, or PDF.' });
    }

    const buffer = await file.toBuffer();
    const storagePath = `${tenantId}/${Date.now()}-${file.filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: file.mimetype });

    if (uploadError) {
      return reply.status(500).send({ error: 'Failed to upload file' });
    }

    // Create document record
    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        tenant_id: tenantId,
        file_name: file.filename,
        file_type: file.mimetype,
        file_size: buffer.length,
        storage_path: storagePath,
        status: 'processing',
      })
      .select()
      .single();

    if (dbError) {
      return reply.status(500).send({ error: 'Failed to create document record' });
    }

    // Fire webhook for upload event
    fireWebhooks(tenantId, 'document.uploaded', doc.id, { file_name: file.filename }).catch(() => {});

    // Process asynchronously (don't block the response)
    processDocument(doc.id, tenantId, buffer, file.mimetype).catch(err => {
      console.error(`Processing failed for ${doc.id}:`, err);
    });

    return reply.status(201).send({
      id: doc.id,
      status: 'processing',
      message: 'Document uploaded and processing started',
    });
  });

  // List documents
  app.get('/', async (request) => {
    const tenantId = getTenantId(request);
    const { status, type, page = '1', limit = '20' } = request.query as Record<string, string>;

    let query = supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range((+page - 1) * +limit, +page * +limit - 1);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('document_type', type);

    const { data, count, error } = await query;
    if (error) return { documents: [], total: 0 };

    return { documents: data, total: count, page: +page, limit: +limit };
  });

  // Get single document
  app.get('/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Document not found' });
    return data;
  });

  // Update document (manual corrections, type change)
  app.patch('/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };
    const updates = request.body as {
      extracted_data?: any;
      document_type?: DocumentType;
      notes?: string;
    };

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Document not found' });
    return data;
  });

  // Approve document
  app.post('/:id/approve', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };

    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'approved', reviewed_by: tenantId, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Document not found' });

    fireWebhooks(tenantId, 'document.approved', id, { extracted_data: data.extracted_data }).catch(() => {});

    return data;
  });

  // Reject document
  app.post('/:id/reject', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };

    const { data, error } = await supabase
      .from('documents')
      .update({
        status: 'rejected',
        reviewed_by: tenantId,
        reviewed_at: new Date().toISOString(),
        notes: reason || null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Document not found' });

    fireWebhooks(tenantId, 'document.rejected', id, { reason: reason || null }).catch(() => {});

    return data;
  });

  // Reprocess a document
  app.post('/:id/reprocess', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };

    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!doc) return reply.status(404).send({ error: 'Document not found' });

    // Download file from storage
    const { data: fileData } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);

    if (!fileData) return reply.status(500).send({ error: 'Failed to retrieve file' });

    await supabase.from('documents').update({ status: 'processing' }).eq('id', id);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    processDocument(id, tenantId, buffer, doc.file_type).catch(err => {
      console.error(`Reprocessing failed for ${id}:`, err);
    });

    return { message: 'Reprocessing started' };
  });

  // Delete document
  app.delete('/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };

    const { data: doc } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!doc) return reply.status(404).send({ error: 'Document not found' });

    await supabase.storage.from('documents').remove([doc.storage_path]);
    await supabase.from('documents').delete().eq('id', id);

    return { message: 'Document deleted' };
  });
}

async function processDocument(
  documentId: string,
  tenantId: string,
  fileBuffer: Buffer,
  mimeType: string
) {
  try {
    let imageBuffer: Buffer;
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    if (mimeType === 'application/pdf') {
      // Convert first page of PDF to image using sharp
      imageBuffer = await sharp(fileBuffer, { pages: 1 }).png().toBuffer();
      mediaType = 'image/png';
    } else {
      imageBuffer = fileBuffer;
      mediaType = mimeType as any;
    }

    const base64 = imageBuffer.toString('base64');
    const result = await extractDocument(base64, mediaType);

    const status: DocumentStatus = result.success
      ? (result.confidence >= 0.8 ? 'extracted' : 'review_required')
      : 'failed';

    await supabase
      .from('documents')
      .update({
        status,
        extracted_data: result.extracted_data,
        confidence: result.confidence,
        document_type: (result as any).detected_type || 'other',
      })
      .eq('id', documentId);

    // Fire webhook for extraction result
    if (status === 'extracted' || status === 'review_required') {
      fireWebhooks(tenantId, 'document.extracted', documentId, {
        confidence: result.confidence,
        document_type: (result as any).detected_type || 'other',
      }).catch(() => {});
    } else if (status === 'failed') {
      fireWebhooks(tenantId, 'document.failed', documentId, {
        error: 'Extraction failed',
      }).catch(() => {});
    }

    // Track usage
    const month = new Date().toISOString().slice(0, 7);
    const { data: existing } = await supabase
      .from('usage')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .single();

    if (existing) {
      await supabase
        .from('usage')
        .update({
          documents_processed: existing.documents_processed + 1,
          tokens_input: existing.tokens_input + result.tokens_used.input,
          tokens_output: existing.tokens_output + result.tokens_used.output,
          total_cost: parseFloat(existing.total_cost) + result.cost,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('usage').insert({
        tenant_id: tenantId,
        month,
        documents_processed: 1,
        tokens_input: result.tokens_used.input,
        tokens_output: result.tokens_used.output,
        total_cost: result.cost,
      });
    }
  } catch (error: any) {
    await supabase
      .from('documents')
      .update({ status: 'failed', notes: error.message })
      .eq('id', documentId);

    fireWebhooks(tenantId, 'document.failed', documentId, {
      error: error.message,
    }).catch(() => {});
  }
}
