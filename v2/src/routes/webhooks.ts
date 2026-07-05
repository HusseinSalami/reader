import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { supabase } from '../db/client.js';
import { getTenantId } from '../middleware/auth.js';
import { WebhookEvent } from '../types/index.js';

export async function webhookRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  const VALID_EVENTS: WebhookEvent[] = [
    'document.uploaded',
    'document.extracted',
    'document.approved',
    'document.rejected',
    'document.failed',
  ];

  // Register a new webhook
  app.post('/', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { url, events } = request.body as { url: string; events: WebhookEvent[] };

    if (!url || !events || events.length === 0) {
      return reply.status(400).send({ error: 'url and events[] are required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return reply.status(400).send({ error: 'Invalid URL' });
    }

    // Validate events
    const invalidEvents = events.filter((e) => !VALID_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return reply.status(400).send({
        error: `Invalid events: ${invalidEvents.join(', ')}. Valid events: ${VALID_EVENTS.join(', ')}`,
      });
    }

    // Generate a signing secret
    const secret = crypto.randomBytes(32).toString('hex');

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        tenant_id: tenantId,
        url,
        secret,
        events,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return reply.status(500).send({ error: 'Failed to create webhook' });
    }

    return reply.status(201).send({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret, // Show secret only at creation time
      is_active: webhook.is_active,
      created_at: webhook.created_at,
    });
  });

  // List webhooks
  app.get('/', async (request) => {
    const tenantId = getTenantId(request);

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('id, url, events, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) return { webhooks: [] };
    return { webhooks: webhooks || [] };
  });

  // Delete a webhook
  app.delete('/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };

    const { data, error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    return { message: 'Webhook deleted' };
  });
}
