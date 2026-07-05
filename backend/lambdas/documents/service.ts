// Document Upload Service
// Phase 2: Document Type & Template Management

import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import {
  DocumentRepository,
  generateCustomerPK,
  generateSK,
} from '../layers/shared/nodejs/repository';
import { now } from '../layers/shared/nodejs/utils';

// Initialize clients
const s3Client = new S3Client({});
const sfnClient = new SFNClient({});

// Environment variables
const BUCKET_NAME = process.env.BUCKET_NAME || 'document-platform-docs';
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const ALLOWED_FORMATS = ['pdf', 'png', 'jpeg', 'jpg', 'tiff', 'tif'];

// ========================================
// Types
// ========================================

export interface DocumentMetadata {
  documentId: string;
  customerId: string;
  documentTypeId: string;
  templateId?: string;
  filename: string;
  fileSize: number;
  s3Key: string;
  s3Bucket: string;
  language: Language;
  status: DocumentStatus;
  uploadedAt: string;
  processedAt?: string;
  extractedData?: ExtractedData;
  validationErrors?: ValidationError[];
  reviewedAt?: string;
  reviewedBy?: string;
}

export type Language = 'en' | 'fr' | 'ar';
export type DocumentStatus = 'uploaded' | 'processing' | 'completed' | 'failed' | 'reviewed' | 'approved';

export interface ExtractedData {
  fields: Record<string, ExtractedField>;
}

export interface ExtractedField {
  fieldId: string;
  value: any;
  confidence?: number;
  source: ExtractionSource;
  corrected: boolean;
  correctionHistory?: FieldCorrection[];
}

export type ExtractionSource = 'textract' | 'bedrock' | 'manual';

export interface FieldCorrection {
  originalValue: any;
  correctedValue: any;
  correctedAt: string;
  correctedBy: string;
}

export interface ValidationError {
  fieldId: string;
  fieldName: string;
  value: any;
  rule: string;
  message: string;
}

export interface UploadDocumentRequest {
  customerId: string;
  documentTypeId: string;
  templateId?: string;
  filename: string;
  fileContent: Buffer;
  fileSize: number;
  language?: Language;
}

export interface UploadDocumentResponse {
  documentId: string;
  s3Key: string;
  uploadedAt: string;
}

// ========================================
// Document Service
// ========================================

export class DocumentService {
  private repository: DocumentRepository;
  private s3Client: S3Client;

  constructor(repository?: DocumentRepository, s3Client?: S3Client) {
    this.repository = repository || new DocumentRepository();
    this.s3Client = s3Client || new S3Client({});
  }

  /**
   * Upload a document with validation
   */
  async uploadDocument(request: UploadDocumentRequest): Promise<UploadDocumentResponse> {
    // Validate file format
    this.validateFileFormat(request.filename);

    // Validate file size
    this.validateFileSize(request.fileSize);

    // Generate unique document ID
    const documentId = uuidv4();

    // Generate S3 key with customer prefix for tenant isolation
    const fileExtension = this.getFileExtension(request.filename);
    const s3Key = `customers/${request.customerId}/documents/${documentId}.${fileExtension}`;

    // Upload file to S3
    await this.uploadToS3(s3Key, request.fileContent);

    // Extract metadata
    const uploadedAt = now();
    const metadata: DocumentMetadata = {
      documentId,
      customerId: request.customerId,
      documentTypeId: request.documentTypeId,
      templateId: request.templateId,
      filename: request.filename,
      fileSize: request.fileSize,
      s3Key,
      s3Bucket: BUCKET_NAME,
      language: request.language || 'en',
      status: 'processing', // Changed from 'uploaded' to 'processing'
      uploadedAt,
    };

    // Store document metadata in DynamoDB
    await this.storeDocumentMetadata(metadata);

    // Trigger Step Functions processing pipeline
    if (STATE_MACHINE_ARN && request.templateId) {
      await this.triggerProcessingPipeline({
        documentId,
        customerId: request.customerId,
        documentTypeId: request.documentTypeId,
        templateId: request.templateId,
        s3Bucket: BUCKET_NAME,
        s3Key,
        language: request.language || 'en',
        useBedrock: true, // Enable Bedrock by default
      });
    }

    return {
      documentId,
      s3Key,
      uploadedAt,
    };
  }

  /**
   * Validate file format
   */
  private validateFileFormat(filename: string): void {
    const extension = this.getFileExtension(filename).toLowerCase();
    
    if (!ALLOWED_FORMATS.includes(extension)) {
      throw new Error(
        `Unsupported file format: ${extension}. Allowed formats: ${ALLOWED_FORMATS.join(', ')}`
      );
    }
  }

  /**
   * Validate file size
   */
  private validateFileSize(fileSize: number): void {
    if (fileSize > MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length < 2) {
      throw new Error('Filename must have an extension');
    }
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Upload file to S3
   */
  private async uploadToS3(s3Key: string, fileContent: Buffer): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ServerSideEncryption: 'AES256',
    });

    await this.s3Client.send(command);
  }

  /**
   * Store document metadata in DynamoDB
   */
  private async storeDocumentMetadata(metadata: DocumentMetadata): Promise<void> {
    const pk = generateCustomerPK(metadata.customerId);
    const sk = generateSK('DOCUMENT', metadata.documentId);

    // Also set GSI2 for querying by status
    const gsi2pk = generateCustomerPK(metadata.customerId);
    const gsi2sk = `STATUS#${metadata.status}#DOCUMENT#${metadata.documentId}`;

    const item = {
      PK: pk,
      SK: sk,
      GSI2PK: gsi2pk,
      GSI2SK: gsi2sk,
      ...metadata,
    };

    await this.repository.put(item);
  }

  /**
   * Get document by ID
   */
  async getDocument(customerId: string, documentId: string): Promise<DocumentMetadata | null> {
    const result = await this.repository.getById(customerId, documentId);
    return result as DocumentMetadata | null;
  }

  /**
   * List documents for a customer
   */
  async listDocuments(customerId: string, options: { limit?: number; nextToken?: string } = {}) {
    return this.repository.getByCustomer(customerId, options);
  }

  /**
   * List documents by status
   */
  async listDocumentsByStatus(
    customerId: string,
    status: DocumentStatus,
    options: { limit?: number; nextToken?: string } = {}
  ) {
    return this.repository.getByStatus(customerId, status, options);
  }

  /**
   * Update document status
   */
  async updateDocumentStatus(
    customerId: string,
    documentId: string,
    status: DocumentStatus
  ): Promise<void> {
    const pk = generateCustomerPK(customerId);
    const sk = generateSK('DOCUMENT', documentId);

    // Update GSI2SK for status queries
    const gsi2pk = generateCustomerPK(customerId);
    const gsi2sk = `STATUS#${status}#DOCUMENT#${documentId}`;

    await this.repository.update(pk, sk, {
      status,
      GSI2SK: gsi2sk,
    });
  }

  /**
   * Store extracted data
   */
  async storeExtractedData(
    customerId: string,
    documentId: string,
    extractedData: ExtractedData,
    validationErrors: ValidationError[] = []
  ): Promise<void> {
    const pk = generateCustomerPK(customerId);
    const sk = generateSK('DOCUMENT', documentId);

    const status: DocumentStatus = validationErrors.length > 0 ? 'completed' : 'completed';

    await this.repository.update(pk, sk, {
      extractedData,
      validationErrors,
      status,
      processedAt: now(),
    });
  }

  /**
   * Trigger Step Functions processing pipeline
   */
  private async triggerProcessingPipeline(input: {
    documentId: string;
    customerId: string;
    documentTypeId: string;
    templateId: string;
    s3Bucket: string;
    s3Key: string;
    language: string;
    useBedrock: boolean;
  }): Promise<void> {
    if (!STATE_MACHINE_ARN) {
      console.warn('STATE_MACHINE_ARN not configured, skipping processing pipeline');
      return;
    }

    try {
      const command = new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        input: JSON.stringify(input),
        name: `${input.documentId}-${Date.now()}`, // Unique execution name
      });

      const result = await sfnClient.send(command);
      console.log('Started Step Functions execution:', result.executionArn);
    } catch (error: any) {
      console.error('Failed to start Step Functions execution:', error);
      // Don't throw - allow upload to succeed even if processing fails to start
    }
  }
}
