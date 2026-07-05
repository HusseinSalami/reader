import crypto from 'node:crypto';
import { supabase } from '../db/client.js';
import { WebhookEvent } from '../types/index.js';

interface WebhookPayload {
  event: WebhookEvent;
  document_id: string;
  tenant_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Fire webhooks for a given event and tenant.
 * Finds all active webhooks matching the event, signs the payload with
 * HMAC-SHA256 using the per-webhook secret, and POSTs to each URL.
 * Fire-and-forget: errors are logged but not retried.
 */
export async function fireWebhooks(
  tenantId: string,
  event: WebhookEvent,
  documentId: string,
  data: Record<string, unknown>
): Promise<void> {
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .contains('events', [event]);

  if (!webhooks || webhooks.length === 0) return;

  const payload: WebhookPayload = {
    event,
    document_id: documentId,
    tenant_id: tenantId,
    data,
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);

  const deliveries = webhooks.map(async (webhook) => {
    try {
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex');

      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err: any) {
      console.error(
        `Webhook delivery failed [${webhook.id}] -> ${webhook.url}: ${err.message}`
      );
    }
  });

  await Promise.allSettled(deliveries);
}
