// Document Service Unit Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentService, UploadDocumentRequest } from './service';
import { DocumentRepository } from '../layers/shared/nodejs/repository';
import { S3Client } from '@aws-sdk/client-s3';

describe('DocumentService', () => {
  let service: DocumentService;
  let mockRepository: any;
  let mockS3Client: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock repository
    mockRepository = {
      put: vi.fn().mockResolvedValue({}),
      get: vi.fn(),
      query: vi.fn(),
      getById: vi.fn(),
      getByCustomer: vi.fn(),
      getByStatus: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    // Mock S3 client
    mockS3Client = {
      send: vi.fn().mockResolvedValue({}),
    };

    service = new DocumentService(mockRepository, mockS3Client as any);
  });

  describe('uploadDocument', () => {
    const validRequest: UploadDocumentRequest = {
      customerId: 'cust-123',
      documentTypeId: 'dt-456',
      filename: 'invoice.pdf',
      fileContent: Buffer.from('test content'),
      fileSize: 1024,
    };

    it('should upload a valid PDF document', async () => {
      const result = await service.uploadDocument(validRequest);

      expect(result).toHaveProperty('documentId');
      expect(result).toHaveProperty('s3Key');
      expect(result).toHaveProperty('uploadedAt');
      expect(result.s3Key).toMatch(/^customers\/cust-123\/documents\/.*\.pdf$/);
    });

    it('should upload a valid PNG document', async () => {
      const request = { ...validRequest, filename: 'scan.png' };
      const result = await service.uploadDocument(request);

      expect(result.s3Key).toMatch(/\.png$/);
    });

    it('should upload a valid JPEG document', async () => {
      const request = { ...validRequest, filename: 'photo.jpeg' };
      const result = await service.uploadDocument(request);

      expect(result.s3Key).toMatch(/\.jpeg$/);
    });

    it('should upload a valid JPG document', async () => {
      const request = { ...validRequest, filename: 'image.jpg' };
      const result = await service.uploadDocument(request);

      expect(result.s3Key).toMatch(/\.jpg$/);
    });

    it('should upload a valid TIFF document', async () => {
      const request = { ...validRequest, filename: 'document.tiff' };
      const result = await service.uploadDocument(request);

      expect(result.s3Key).toMatch(/\.tiff$/);
    });

    it('should upload a valid TIF document', async () => {
      const request = { ...validRequest, filename: 'scan.tif' };
      const result = await service.uploadDocument(request);

      expect(result.s3Key).toMatch(/\.tif$/);
    });

    it('should reject unsupported file format', async () => {
      const request = { ...validRequest, filename: 'document.docx' };

      await expect(service.uploadDocument(request)).rejects.toThrow(
        'Unsupported file format'
      );
    });

    it('should reject file without extension', async () => {
      const request = { ...validRequest, filename: 'document' };

      await expect(service.uploadDocument(request)).rejects.toThrow(
        'Filename must have an extension'
      );
    });

    it('should reject file exceeding 10MB', async () => {
      const request = {
        ...validRequest,
        fileSize: 11 * 1024 * 1024, // 11MB
      };

      await expect(service.uploadDocument(request)).rejects.toThrow(
        'File size exceeds maximum allowed size'
      );
    });

    it('should accept file exactly at 10MB boundary', async () => {
      const request = {
        ...validRequest,
        fileSize: 10 * 1024 * 1024, // Exactly 10MB
      };

      const result = await service.uploadDocument(request);
      expect(result).toHaveProperty('documentId');
    });

    it('should use customer ID in S3 key for tenant isolation', async () => {
      const result = await service.uploadDocument(validRequest);

      expect(result.s3Key).toContain('customers/cust-123/');
    });

    it('should extract metadata correctly', async () => {
      await service.uploadDocument(validRequest);

      expect(mockRepository.put).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-123',
          documentTypeId: 'dt-456',
          filename: 'invoice.pdf',
          fileSize: 1024,
          status: 'processing',
        })
      );
    });

    it('should default language to English', async () => {
      await service.uploadDocument(validRequest);

      expect(mockRepository.put).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'en',
        })
      );
    });

    it('should use provided language', async () => {
      const request = { ...validRequest, language: 'fr' as const };
      await service.uploadDocument(request);

      expect(mockRepository.put).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'fr',
        })
      );
    });

    it('should include templateId if provided', async () => {
      const request = { ...validRequest, templateId: 'tmpl-789' };
      await service.uploadDocument(request);

      expect(mockRepository.put).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'tmpl-789',
        })
      );
    });

    it('should upload file to S3 with encryption', async () => {
      await service.uploadDocument(validRequest);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ServerSideEncryption: 'AES256',
          }),
        })
      );
    });

    it('should set GSI2 keys for status queries', async () => {
      await service.uploadDocument(validRequest);

      expect(mockRepository.put).toHaveBeenCalledWith(
        expect.objectContaining({
          GSI2PK: 'CUSTOMER#cust-123',
          GSI2SK: expect.stringMatching(/^STATUS#processing#DOCUMENT#/),
        })
      );
    });

    it('should handle case-insensitive file extensions', async () => {
      const request = { ...validRequest, filename: 'INVOICE.PDF' };
      const result = await service.uploadDocument(request);

      expect(result.s3Key).toMatch(/\.pdf$/);
    });
  });

  describe('getDocument', () => {
    it('should retrieve document by ID', async () => {
      const mockDocument = {
        PK: 'CUSTOMER#cust-123',
        SK: 'DOCUMENT#doc-999',
        documentId: 'doc-999',
        customerId: 'cust-123',
        filename: 'test.pdf',
      };

      mockRepository.getById.mockResolvedValue(mockDocument);

      const result = await service.getDocument('cust-123', 'doc-999');

      expect(result).toEqual(mockDocument);
      expect(mockRepository.getById).toHaveBeenCalledWith('cust-123', 'doc-999');
    });

    it('should return null for non-existent document', async () => {
      mockRepository.getById.mockResolvedValue(null);

      const result = await service.getDocument('cust-123', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listDocuments', () => {
    it('should list all documents for a customer', async () => {
      const mockDocuments = {
        items: [
          { documentId: 'doc-1', filename: 'file1.pdf' },
          { documentId: 'doc-2', filename: 'file2.pdf' },
        ],
        count: 2,
      };

      mockRepository.getByCustomer.mockResolvedValue(mockDocuments);

      const result = await service.listDocuments('cust-123');

      expect(result).toEqual(mockDocuments);
      expect(mockRepository.getByCustomer).toHaveBeenCalledWith('cust-123', {});
    });

    it('should support pagination', async () => {
      const mockDocuments = {
        items: [],
        count: 0,
        nextToken: 'token-123',
      };

      mockRepository.getByCustomer.mockResolvedValue(mockDocuments);

      const result = await service.listDocuments('cust-123', {
        limit: 10,
        nextToken: 'token-123',
      });

      expect(mockRepository.getByCustomer).toHaveBeenCalledWith('cust-123', {
        limit: 10,
        nextToken: 'token-123',
      });
    });
  });

  describe('listDocumentsByStatus', () => {
    it('should list documents by status', async () => {
      const mockDocuments = {
        items: [{ documentId: 'doc-1', status: 'completed' }],
        count: 1,
      };

      mockRepository.getByStatus.mockResolvedValue(mockDocuments);

      const result = await service.listDocumentsByStatus('cust-123', 'completed');

      expect(result).toEqual(mockDocuments);
      expect(mockRepository.getByStatus).toHaveBeenCalledWith(
        'cust-123',
        'completed',
        {}
      );
    });
  });

  describe('updateDocumentStatus', () => {
    it('should update document status', async () => {
      await service.updateDocumentStatus('cust-123', 'doc-999', 'processing');

      expect(mockRepository.update).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'DOCUMENT#doc-999',
        expect.objectContaining({
          status: 'processing',
          GSI2SK: 'STATUS#processing#DOCUMENT#doc-999',
        })
      );
    });
  });

  describe('storeExtractedData', () => {
    it('should store extracted data without validation errors', async () => {
      const extractedData = {
        fields: {
          'field-1': {
            fieldId: 'field-1',
            value: 'INV-123',
            confidence: 0.95,
            source: 'textract' as const,
            corrected: false,
          },
        },
      };

      await service.storeExtractedData('cust-123', 'doc-999', extractedData);

      expect(mockRepository.update).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'DOCUMENT#doc-999',
        expect.objectContaining({
          extractedData,
          validationErrors: [],
          status: 'completed',
        })
      );
    });

    it('should store extracted data with validation errors', async () => {
      const extractedData = {
        fields: {
          'field-1': {
            fieldId: 'field-1',
            value: 'invalid',
            confidence: 0.95,
            source: 'textract' as const,
            corrected: false,
          },
        },
      };

      const validationErrors = [
        {
          fieldId: 'field-1',
          fieldName: 'invoice_number',
          value: 'invalid',
          rule: 'regex',
          message: 'Value does not match pattern',
        },
      ];

      await service.storeExtractedData(
        'cust-123',
        'doc-999',
        extractedData,
        validationErrors
      );

      expect(mockRepository.update).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'DOCUMENT#doc-999',
        expect.objectContaining({
          extractedData,
          validationErrors,
          status: 'completed',
        })
      );
    });
  });
});
