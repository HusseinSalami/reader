#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DocumentReaderStack } from './document-reader-stack';
import { MultiTenantDocumentPlatformStack } from './multi-tenant-stack';

const app = new cdk.App();

// Configuration - set these environment variables or update directly
const AWS_ACCOUNT = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

if (!AWS_ACCOUNT) {
  throw new Error(
    'AWS account ID is required. Set AWS_ACCOUNT_ID environment variable or configure AWS CLI.'
  );
}

// Original single-tenant stack (keep for reference)
// new DocumentReaderStack(app, 'DocumentReaderStack', {
//   env: {
//     account: AWS_ACCOUNT,
//     region: AWS_REGION,
//   },
//   description: 'Document Reader Service - AI-powered document digitization with AWS Textract',
// });

// New multi-tenant platform stack
new MultiTenantDocumentPlatformStack(app, 'DocumentPlatformStack', {
  env: {
    account: AWS_ACCOUNT,
    region: AWS_REGION,
  },
  description: 'Multi-Tenant Document Processing Platform - Intelligent document processing with trainable templates',
});

app.synth();
