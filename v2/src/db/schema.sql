-- Reader V2: Supabase PostgreSQL Schema
-- Run this in the Supabase SQL editor to set up the database

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Tenants (companies/organizations)
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  company_name text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro', 'enterprise')),
  settings jsonb not null default '{"max_documents_per_month": 100, "max_file_size_mb": 10, "ai_model": "haiku"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  document_type text not null default 'other' check (document_type in ('invoice', 'receipt', 'credit_note', 'purchase_order', 'delivery_note', 'bank_statement', 'expense_report', 'contract', 'other')),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'extracted', 'review_required', 'approved', 'rejected', 'failed')),
  extracted_data jsonb,
  confidence real,
  language text,
  notes text,
  reviewed_by uuid references tenants(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Usage tracking (monthly)
create table usage (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  month text not null, -- YYYY-MM
  documents_processed integer not null default 0,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  total_cost numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, month)
);

-- Indexes
create index idx_documents_tenant on documents(tenant_id);
create index idx_documents_status on documents(tenant_id, status);
create index idx_documents_type on documents(tenant_id, document_type);
create index idx_documents_created on documents(tenant_id, created_at desc);
create index idx_usage_tenant_month on usage(tenant_id, month);

-- Row Level Security
alter table tenants enable row level security;
alter table documents enable row level security;
alter table usage enable row level security;

-- RLS Policies (service role bypasses these; app uses service key with tenant_id filter)
create policy "Tenants can read own data" on tenants for select using (true);
create policy "Documents belong to tenant" on documents for all using (true);
create policy "Usage belongs to tenant" on usage for all using (true);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tenants_updated_at before update on tenants for each row execute function update_updated_at();
create trigger documents_updated_at before update on documents for each row execute function update_updated_at();
create trigger usage_updated_at before update on usage for each row execute function update_updated_at();

-- Storage bucket (create via Supabase dashboard or API)
-- Bucket: 'documents' with 10MB max file size
