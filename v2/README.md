# Reader V2 — Simplified Document Scanner for ERP

A lightweight document scanning and digitization service designed for ERP integration. Upload invoices, receipts, and transactions — get structured data, PDFs, and Excel exports.

## Architecture

| Layer | Technology | Cost |
|-------|-----------|------|
| Backend | Fastify (Node.js) | $5/mo (Railway/Fly.io) |
| Database | Supabase PostgreSQL | Free tier (500MB) |
| Storage | Supabase Storage | Free tier (1GB) |
| OCR/AI | Claude Vision (Haiku) | ~$0.001/document |
| PDF Generation | PDFKit | Free (bundled) |
| Excel Export | SheetJS | Free (bundled) |
| Frontend | React + Vite | Free (Vercel) |

**Total cost at 1,000 docs/month: ~$6-8** (vs ~$18+ with AWS)

## Features

- Upload documents (JPEG, PNG, WebP, PDF)
- AI-powered extraction via Claude Vision (invoices, receipts, POs, etc.)
- Auto-classification of document type
- Confidence scoring with review workflow
- Manual correction interface
- PDF generation from extracted data
- Excel/CSV export (summary + line items)
- Multi-tenant with JWT auth
- Usage tracking and cost monitoring

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Supabase and Anthropic keys

# Run database migrations (in Supabase SQL editor, paste db/schema.sql)

# Start dev server
npm run dev
```

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Get JWT token

### Documents
- `POST /api/documents/upload` — Upload and process document
- `GET /api/documents` — List documents (filter by status, type)
- `GET /api/documents/:id` — Get document details
- `PATCH /api/documents/:id` — Update extracted data
- `POST /api/documents/:id/approve` — Approve document
- `POST /api/documents/:id/reject` — Reject document
- `POST /api/documents/:id/reprocess` — Re-run extraction
- `DELETE /api/documents/:id` — Delete document

### Exports
- `GET /api/exports/pdf/:id` — Download document as PDF
- `GET /api/exports/excel` — Export documents as Excel
- `GET /api/exports/csv` — Export documents as CSV
- `GET /api/exports/usage` — Get usage stats

## ERP Integration

This service is designed to be embedded in an ERP system:

1. **Invoice Processing**: Upload vendor invoices → auto-extract all fields → approve → post to accounts payable
2. **Receipt Digitization**: Snap photos of receipts → extract amounts → create expense entries
3. **Transaction Import**: Scan bank statements → extract transactions → reconcile with ledger
4. **Document Archive**: All originals stored with full-text search capability

## Deployment

### Railway (recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway init
railway up
```

### Docker
```bash
npm run build
docker build -t reader-v2 .
docker run -p 3001:3001 --env-file .env reader-v2
```

## Migration from V1 (AWS)

V2 replaces the entire AWS stack:
- **7 Lambda functions + Step Functions** → 1 Fastify server
- **AWS Textract + Bedrock** → Claude Vision API (one call does it all)
- **DynamoDB** → PostgreSQL (Supabase)
- **S3 + CloudFront** → Supabase Storage + Vercel
- **CDK** → `docker build` or `railway up`
