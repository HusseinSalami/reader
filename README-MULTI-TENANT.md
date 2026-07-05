# Multi-Tenant Document Processing Platform

A scalable, intelligent document processing platform with trainable templates, multi-language support, and flexible extraction rules.

## 🚀 Quick Start

### API Endpoint
```
https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/
```

### Register Your Company
```bash
curl -X POST https://9v6qu1ilzi.execute-api.us-east-1.amazonaws.com/prod/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Your Company",
    "email": "admin@yourcompany.com",
    "firstName": "Your",
    "lastName": "Name",
    "subscriptionTier": "FREE"
  }'
```

### Test the API
```bash
./test-api.sh
```

## 📋 Features

### ✅ Phase 1: Multi-Tenant Foundation (DEPLOYED)
- Customer registration and management
- JWT authentication with Cognito
- Multi-tenant data isolation
- Subscription tiers (FREE, PRO, ENTERPRISE)
- RESTful API with API Gateway

### 🚧 Phase 2: Document Type Management (Next)
- Custom document type creation
- Template builder
- Field extraction rules
- Schema validation

### 🚧 Phase 3: Invoice Processing
- Invoice-specific extraction
- Line item tables
- Validation rules
- Export to accounting systems

### 🚧 Phase 4: Exam Processing
- Answer key management
- Auto-grading
- Rubric-based scoring
- Grade export

## 🏗️ Architecture

```
┌─────────────┐
│   Frontend  │
│   (React)   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│   API Gateway       │
│   + Cognito Auth    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Lambda Functions  │
│   - Register        │
│   - Login           │
│   - Authorizer      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────────────────┐
│   Data Layer                    │
│   - DynamoDB (6 tables)         │
│   - S3 (documents)              │
│   - SQS (processing)            │
└─────────────────────────────────┘
```

## 📊 Subscription Tiers

| Feature | FREE | PRO | ENTERPRISE |
|---------|------|-----|------------|
| Documents/month | 100 | 1,000 | Unlimited |
| Users | 1 | 5 | Unlimited |
| Languages | English | EN, FR, AR | EN, FR, AR |
| API Access | ❌ | ✅ | ✅ |
| Webhooks | ❌ | ✅ | ✅ |
| ML Enhancement | ❌ | ❌ | ✅ |
| Price | Free | $99/mo | Custom |

## 🔧 Development

### Prerequisites
- Node.js 18+
- AWS CLI configured
- AWS CDK installed

### Deploy
```bash
cd reader/backend
./deploy-multi-tenant.sh
```

### Test
```bash
cd reader
./test-api.sh
```

## 📚 Documentation

- [Deployment Success](./DEPLOYMENT-SUCCESS.md) - Full deployment details
- [Phase 1 Progress](./PHASE1-PROGRESS.md) - Implementation progress
- [Requirements](../.kiro/specs/multi-tenant-document-platform/requirements.md) - Full requirements
- [Design](../.kiro/specs/multi-tenant-document-platform/design.md) - Architecture design
- [Tasks](../.kiro/specs/multi-tenant-document-platform/tasks.md) - Implementation tasks

## 🎯 Roadmap

- [x] Phase 1: Multi-tenant foundation (60% complete)
- [ ] Phase 1: User management (40% remaining)
- [ ] Phase 2: Document type management
- [ ] Phase 3: Invoice processing
- [ ] Phase 4: Exam processing
- [ ] Phase 5: Training & ML
- [ ] Phase 6: API & Webhooks
- [ ] Phase 7: ERP Integrations
- [ ] Phase 8: Multi-language support
- [ ] Phase 9: Security & Compliance
- [ ] Phase 10: Performance optimization

## 💡 Use Cases

### Invoice Processing
- Extract invoice data automatically
- Validate totals and line items
- Export to QuickBooks, Xero, SAP
- Learn from corrections

### Exam Grading
- Upload answer keys
- Auto-grade multiple choice
- AI-powered essay scoring
- Export grades to CSV

### Custom Documents
- Define your own document types
- Create extraction templates
- Train with sample documents
- Integrate via API

## 🔐 Security

- JWT authentication
- Customer data isolation
- Encryption at rest
- IAM least privilege
- Audit logging
- GDPR compliant

## 📞 Support

For issues or questions:
1. Check [DEPLOYMENT-SUCCESS.md](./DEPLOYMENT-SUCCESS.md)
2. Review [Phase 1 Progress](./PHASE1-PROGRESS.md)
3. Check AWS CloudWatch logs

## 📄 License

Internal project - All rights reserved
