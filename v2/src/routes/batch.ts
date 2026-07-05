import { FastifyInstance } from 'fastify';
import { supabase } from '../db/client.js';
import { getTenantId } from '../middleware/auth.js';
import { extractDocument } from '../services/ocr.js';
import sharp from 'sharp';

export async function batchRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Batch upload multiple documents
  app.post('/', async (request, reply) => {
    const tenantId = getTenantId(request);
    const parts = request.files();

    const files: { filename: string; mimetype: string; buffer: Buffer }[] = [];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    for await (const part of parts) {
      if (!allowedTypes.includes(part.mimetype)) continue;
      const buffer = await part.toBuffer();
      files.push({ filename: part.filename, mimetype: part.mimetype, buffer });
    }

    if (files.length === 0) {
      return reply.status(400).send({ error: 'No valid files uploaded' });
    }

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert({
        tenant_id: tenantId,
        total_files: files.length,
      })
      .select()
      .single();

    if (batchError || !batch) {
      return reply.status(500).send({ error: 'Failed to create batch' });
    }

    // Process all files in parallel
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const storagePath = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.filename}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file.buffer, { contentType: file.mimetype });

        if (uploadError) throw new Error('Upload failed');

        // Create document record
        const { data: doc, error: dbError } = await supabase
          .from('documents')
          .insert({
            tenant_id: tenantId,
            file_name: file.filename,
            file_type: file.mimetype,
            file_size: file.buffer.length,
            storage_path: storagePath,
            status: 'processing',
            batch_id: batch.id,
          })
          .select()
          .single();

        if (dbError || !doc) throw new Error('DB insert failed');

        // Process document (OCR)
        try {
          let imageBuffer: Buffer;
          let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

          if (file.mimetype === 'application/pdf') {
            imageBuffer = await sharp(file.buffer, { pages: 1 }).png().toBuffer();
            mediaType = 'image/png';
          } else {
            imageBuffer = file.buffer;
            mediaType = file.mimetype as any;
          }

          const base64 = imageBuffer.toString('base64');
          const result = await extractDocument(base64, mediaType);

          const status = result.success
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
            .eq('id', doc.id);
        } catch (err: any) {
          await supabase
            .from('documents')
            .update({ status: 'failed', notes: err.message })
            .eq('id', doc.id);
          throw err;
        }

        return { file_name: file.filename, document_id: doc.id, status: 'success' };
      })
    );

    // Tally results
    let succeeded = 0;
    let failed = 0;
    const resultSummary = results.map((r, i) => {
      if (r.status === 'fulfilled') {
        succeeded++;
        return r.value;
      } else {
        failed++;
        return { file_name: files[i].filename, document_id: null, status: 'failed' };
      }
    });

    const batchStatus = failed === 0 ? 'completed' : (succeeded === 0 ? 'completed' : 'partial');

    await supabase
      .from('batches')
      .update({
        processed: files.length,
        succeeded,
        failed,
        status: batchStatus,
      })
      .eq('id', batch.id);

    return reply.status(201).send({
      batch_id: batch.id,
      total: files.length,
      succeeded,
      failed,
      status: batchStatus,
      results: resultSummary,
    });
  });

  // Get batch status
  app.get('/:batchId', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { batchId } = request.params as { batchId: string };

    const { data: batch, error } = await supabase
      .from('batches')
      .select('*')
      .eq('id', batchId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !batch) {
      return reply.status(404).send({ error: 'Batch not found' });
    }

    // Get documents in this batch
    const { data: documents } = await supabase
      .from('documents')
      .select('id, file_name, status, document_type, confidence, created_at')
      .eq('tenant_id', tenantId)
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });

    return { ...batch, documents: documents || [] };
  });
}
