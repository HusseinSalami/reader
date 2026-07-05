// Document Type Service Unit Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentTypeService, sanitizeName, validateFieldId, validateSchema } from './service';

describe('DocumentTypeService', () => {
  let service: DocumentTypeService;
  let mockRepository: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock repository
    mockRepository = {
      getByCustomer: vi.fn(),
      getById: vi.fn(),
      put: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteWithCascade: vi.fn(),
    };
    service = new DocumentTypeService(mockRepository);
  });

  describe('sanitizeName', () => {
    it('should remove special characters', () => {
      expect(sanitizeName('Invoice@#$%')).toBe('Invoice');
    });

    it('should keep alphanumeric, hyphens, underscores, and spaces', () => {
      expect(sanitizeName('Invoice_Type-123 ABC')).toBe('Invoice_Type-123 ABC');
    });

    it('should handle empty string after sanitization', () => {
      expect(sanitizeName('@#$%')).toBe('');
    });
  });

  describe('validateFieldId', () => {
    it('should accept valid field IDs', () => {
      expect(() => validateFieldId('invoice_number')).not.toThrow();
      expect(() => validateFieldId('total-amount')).not.toThrow();
      expect(() => validateFieldId('field123')).not.toThrow();
    });

    it('should reject field IDs with spaces', () => {
      expect(() => validateFieldId('invoice number')).toThrow('Invalid field ID');
    });

    it('should reject field IDs with special characters', () => {
      expect(() => validateFieldId('invoice@number')).toThrow('Invalid field ID');
      expect(() => validateFieldId('total$amount')).toThrow('Invalid field ID');
    });
  });

  describe('validateSchema', () => {
    it('should accept valid schema', () => {
      const schema = {
        fields: [
          {
            fieldId: 'field-1',
            name: 'invoice_number',
            dataType: 'text' as const,
            required: true,
            validationRules: [],
          },
        ],
      };

      expect(() => validateSchema(schema)).not.toThrow();
    });

    it('should reject schema without fields array', () => {
      const schema = {} as any;
      expect(() => validateSchema(schema)).toThrow('Schema must contain a fields array');
    });

    it('should reject duplicate field IDs', () => {
      const schema = {
        fields: [
          {
            fieldId: 'invoice_number',
            name: 'Invoice Number',
            dataType: 'text' as const,
            required: true,
            validationRules: [],
          },
          {
            fieldId: 'invoice_number',
            name: 'Invoice #',
            dataType: 'text' as const,
            required: false,
            validationRules: [],
          },
        ],
      };

      expect(() => validateSchema(schema)).toThrow('Duplicate field ID: invoice_number');
    });

    it('should reject invalid data types', () => {
      const schema = {
        fields: [
          {
            fieldId: 'field-1',
            name: 'test_field',
            dataType: 'invalid' as any,
            required: true,
            validationRules: [],
          },
        ],
      };

      expect(() => validateSchema(schema)).toThrow('Invalid data type');
    });

    it('should require tableConfig for table fields', () => {
      const schema = {
        fields: [
          {
            fieldId: 'field-1',
            name: 'items_table',
            dataType: 'table' as const,
            required: true,
            validationRules: [],
          },
        ],
      };

      expect(() => validateSchema(schema)).toThrow('Table field items_table must have a tableConfig');
    });

    it('should validate table columns', () => {
      const schema = {
        fields: [
          {
            fieldId: 'field-1',
            name: 'items_table',
            dataType: 'table' as const,
            required: true,
            validationRules: [],
            tableConfig: {
              columns: [
                { name: 'item_name', dataType: 'text' as const },
                { name: 'quantity', dataType: 'number' as const },
              ],
            },
          },
        ],
      };

      expect(() => validateSchema(schema)).not.toThrow();
    });

    it('should reject duplicate column names in table', () => {
      const schema = {
        fields: [
          {
            fieldId: 'field-1',
            name: 'items_table',
            dataType: 'table' as const,
            required: true,
            validationRules: [],
            tableConfig: {
              columns: [
                { name: 'item_name', dataType: 'text' as const },
                { name: 'item_name', dataType: 'number' as const },
              ],
            },
          },
        ],
      };

      expect(() => validateSchema(schema)).toThrow('Duplicate column name');
    });
  });

  describe('createDocumentType', () => {
    it('should create document type with valid input', async () => {
      const customerId = 'customer-123';
      const input = {
        name: 'Invoice',
        description: 'Standard invoice documents',
        schema: {
          fields: [
            {
              fieldId: 'field-1',
              name: 'invoice_number',
              dataType: 'text' as const,
              required: true,
              validationRules: [],
            },
          ],
        },
      };

      mockRepository.getByCustomer.mockResolvedValue({ items: [], count: 0 });
      mockRepository.put.mockResolvedValue({} as any);

      const result = await service.createDocumentType(customerId, input);

      expect(result.name).toBe('Invoice');
      expect(result.description).toBe('Standard invoice documents');
      expect(result.customerId).toBe(customerId);
      expect(result.documentTypeId).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(mockRepository.put).toHaveBeenCalledTimes(1);
    });

    it('should sanitize document type name', async () => {
      const customerId = 'customer-123';
      const input = {
        name: 'Invoice@#$%',
        description: 'Test',
        schema: { fields: [] },
      };

      mockRepository.getByCustomer.mockResolvedValue({ items: [], count: 0 });
      mockRepository.put.mockResolvedValue({} as any);

      const result = await service.createDocumentType(customerId, input);

      expect(result.name).toBe('Invoice');
    });

    it('should reject duplicate document type names', async () => {
      const customerId = 'customer-123';
      const input = {
        name: 'Invoice',
        description: 'Test',
        schema: { fields: [] },
      };

      mockRepository.getByCustomer.mockResolvedValue({
        items: [
          {
            documentTypeId: 'existing-id',
            name: 'Invoice',
            customerId,
          } as any,
        ],
        count: 1,
      });

      await expect(service.createDocumentType(customerId, input)).rejects.toThrow(
        'Document type with name "Invoice" already exists'
      );
    });

    it('should reject empty name after sanitization', async () => {
      const customerId = 'customer-123';
      const input = {
        name: '@#$%',
        description: 'Test',
        schema: { fields: [] },
      };

      await expect(service.createDocumentType(customerId, input)).rejects.toThrow(
        'Document type name cannot be empty after sanitization'
      );
    });
  });

  describe('getDocumentType', () => {
    it('should return document type when found', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';
      const mockDocType = {
        documentTypeId,
        customerId,
        name: 'Invoice',
        description: 'Test',
        schema: { fields: [] },
      };

      mockRepository.getById.mockResolvedValue(mockDocType as any);

      const result = await service.getDocumentType(customerId, documentTypeId);

      expect(result).toEqual(mockDocType);
      expect(mockRepository.getById).toHaveBeenCalledWith(customerId, documentTypeId);
    });

    it('should return null when not found', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';

      mockRepository.getById.mockResolvedValue(null);

      const result = await service.getDocumentType(customerId, documentTypeId);

      expect(result).toBeNull();
    });

    it('should reject cross-tenant access', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';
      const mockDocType = {
        PK: 'CUSTOMER#different-customer',
        SK: 'DOCTYPE#doctype-456',
        documentTypeId,
        customerId: 'different-customer',
        name: 'Invoice',
      };

      mockRepository.getById.mockResolvedValue(mockDocType as any);

      await expect(service.getDocumentType(customerId, documentTypeId)).rejects.toThrow(
        'Access denied'
      );
    });
  });

  describe('listDocumentTypes', () => {
    it('should list document types for customer', async () => {
      const customerId = 'customer-123';
      const mockDocTypes = [
        { documentTypeId: 'dt-1', name: 'Invoice' },
        { documentTypeId: 'dt-2', name: 'Receipt' },
      ];

      mockRepository.getByCustomer.mockResolvedValue({
        items: mockDocTypes as any,
        count: 2,
      });

      const result = await service.listDocumentTypes(customerId);

      expect(result.items).toEqual(mockDocTypes);
      expect(result.items.length).toBe(2);
      expect(mockRepository.getByCustomer).toHaveBeenCalledWith(customerId, {});
    });

    it('should support pagination', async () => {
      const customerId = 'customer-123';
      const options = { limit: 10, nextToken: 'token-123' };

      mockRepository.getByCustomer.mockResolvedValue({
        items: [],
        count: 0,
        nextToken: 'next-token',
      });

      const result = await service.listDocumentTypes(customerId, options);

      expect(result.nextToken).toBe('next-token');
      expect(mockRepository.getByCustomer).toHaveBeenCalledWith(customerId, options);
    });
  });

  describe('updateDocumentType', () => {
    it('should update document type name', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';
      const existing = {
        PK: 'CUSTOMER#customer-123',
        SK: 'DOCTYPE#doctype-456',
        documentTypeId,
        customerId,
        name: 'Old Name',
        description: 'Test',
        schema: { fields: [] },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockRepository.getById.mockResolvedValue(existing as any);
      mockRepository.getByCustomer.mockResolvedValue({ items: [], count: 0 });
      mockRepository.update.mockResolvedValue({
        ...existing,
        name: 'New Name',
        updatedAt: '2024-01-02T00:00:00Z',
      } as any);

      const result = await service.updateDocumentType(customerId, documentTypeId, {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(result.documentTypeId).toBe(documentTypeId);
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z'); // Should not change
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should update document type schema', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';
      const existing = {
        PK: 'CUSTOMER#customer-123',
        SK: 'DOCTYPE#doctype-456',
        documentTypeId,
        customerId,
        name: 'Invoice',
        description: 'Test',
        schema: { fields: [] },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const newSchema = {
        fields: [
          {
            fieldId: 'field-1',
            name: 'invoice_number',
            dataType: 'text' as const,
            required: true,
            validationRules: [],
          },
        ],
      };

      mockRepository.getById.mockResolvedValue(existing as any);
      mockRepository.update.mockResolvedValue({
        ...existing,
        schema: newSchema,
        updatedAt: '2024-01-02T00:00:00Z',
      } as any);

      const result = await service.updateDocumentType(customerId, documentTypeId, {
        schema: newSchema,
      });

      expect(result.schema).toEqual(newSchema);
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should reject update for non-existent document type', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';

      mockRepository.getById.mockResolvedValue(null);

      await expect(
        service.updateDocumentType(customerId, documentTypeId, { name: 'New Name' })
      ).rejects.toThrow('Document type doctype-456 not found');
    });

    it('should reject duplicate name on update', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';
      const existing = {
        PK: 'CUSTOMER#customer-123',
        SK: 'DOCTYPE#doctype-456',
        documentTypeId,
        customerId,
        name: 'Invoice',
        description: 'Test',
        schema: { fields: [] },
      };

      mockRepository.getById.mockResolvedValue(existing as any);
      mockRepository.getByCustomer.mockResolvedValue({
        items: [
          {
            documentTypeId: 'other-id',
            name: 'Receipt',
            customerId,
          } as any,
        ],
        count: 1,
      });

      await expect(
        service.updateDocumentType(customerId, documentTypeId, { name: 'Receipt' })
      ).rejects.toThrow('Document type with name "Receipt" already exists');
    });
  });

  describe('deleteDocumentType', () => {
    it('should delete document type with cascade', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';
      const existing = {
        PK: 'CUSTOMER#customer-123',
        SK: 'DOCTYPE#doctype-456',
        documentTypeId,
        customerId,
        name: 'Invoice',
      };

      mockRepository.getById.mockResolvedValue(existing as any);
      mockRepository.deleteWithCascade.mockResolvedValue(undefined);

      await service.deleteDocumentType(customerId, documentTypeId);

      expect(mockRepository.deleteWithCascade).toHaveBeenCalledWith(customerId, documentTypeId);
    });

    it('should reject delete for non-existent document type', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';

      mockRepository.getById.mockResolvedValue(null);

      await expect(service.deleteDocumentType(customerId, documentTypeId)).rejects.toThrow(
        'Document type doctype-456 not found'
      );
    });

    it('should reject cross-tenant delete', async () => {
      const customerId = 'customer-123';
      const documentTypeId = 'doctype-456';
      const existing = {
        PK: 'CUSTOMER#different-customer',
        SK: 'DOCTYPE#doctype-456',
        documentTypeId,
        customerId: 'different-customer',
        name: 'Invoice',
      };

      mockRepository.getById.mockResolvedValue(existing as any);

      await expect(service.deleteDocumentType(customerId, documentTypeId)).rejects.toThrow(
        'Access denied'
      );
    });
  });
});
