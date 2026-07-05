import { FastifyInstance } from 'fastify';
import { supabase } from '../db/client.js';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const { email, password, name, company_name } = request.body as {
      email: string;
      password: string;
      name: string;
      company_name?: string;
    };

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'Email, password, and name are required' });
    }

    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        email,
        password_hash: hashPassword(password),
        name,
        company_name: company_name || null,
      })
      .select()
      .single();

    if (error) {
      return reply.status(500).send({ error: 'Failed to create account' });
    }

    const token = app.jwt.sign(
      { tenant_id: tenant.id, email: tenant.email, role: 'admin' },
      { expiresIn: '7d' }
    );

    return { token, tenant: { id: tenant.id, name: tenant.name, email: tenant.email } };
  });

  app.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('email', email)
      .eq('password_hash', hashPassword(password))
      .single();

    if (!tenant) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign(
      { tenant_id: tenant.id, email: tenant.email, role: 'admin' },
      { expiresIn: '7d' }
    );

    return { token, tenant: { id: tenant.id, name: tenant.name, email: tenant.email } };
  });
}
