import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.js';
import { documentRoutes } from './routes/documents.js';
import { exportRoutes } from './routes/exports.js';
import { searchRoutes } from './routes/search.js';
import { batchRoutes } from './routes/batch.js';
import { webhookRoutes } from './routes/webhooks.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
await app.register(jwt, { secret: process.env.JWT_SECRET! });

app.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(batchRoutes, { prefix: '/api/documents/batch' });
await app.register(documentRoutes, { prefix: '/api/documents' });
await app.register(exportRoutes, { prefix: '/api/exports' });
await app.register(searchRoutes, { prefix: '/api/search' });
await app.register(webhookRoutes, { prefix: '/api/webhooks' });

app.get('/api/health', async () => ({ status: 'ok', version: '2.0.0' }));

const port = parseInt(process.env.PORT || '3001');
await app.listen({ port, host: '0.0.0.0' });
console.log(`Server running on port ${port}`);
