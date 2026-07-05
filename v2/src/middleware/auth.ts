import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthPayload } from '../types/index.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export function getTenantId(request: FastifyRequest): string {
  const payload = request.user as AuthPayload;
  return payload.tenant_id;
}
