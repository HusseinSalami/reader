// Template Service - Unit Tests
// Phase 2: Document Type & Template Management

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TemplateService,
  CreateTemplateInput,
  UpdateTemplateInput,
  validateExtractionRule,
  validateExtractionRules,
  ExtractionRule,
  TextractKVParams,
  RegexParams,
  BoundingBoxParams,
  TableParams,
} from './service';
import {
  TemplateRepository,
  DocumentTypeRepository,
  generateCustomerPK,
  generateSK,
} from '../layers/shared/nodejs/repository';

// Mock repositories
vi.mock('../layers/shared/nodejs/repository', async () => {
  const actual = await vi.importActual('../layers/shared/nodejs/repository');
  return {
    ...actual,
    TemplateRepository: vi.fn(),
    DocumentTypeRepository: vi.fn(),
  };
});

describe('TemplateService', () => {
  let service: TemplateService;
  let mockTemplateRepo: any;
  let mockDocTypeRepo: any;
  const customerId = 'customer-123';
  const documentTypeId = 'doctype-456';
  const templateId = 'template-789';

  beforeEach(() => {
    // Reset mocks
    mockTemplateRepo = {
      put: vi.fn(),
      getById: vi.fn(),
      getByCustomer: vi.fn(),
      getByDocumentType: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockDocTypeRepo = {
      getById: vi.fn(),
    };

    service = new TemplateService(mockTemplateRepo, mockDocTypeRepo);
  });

  describe('createTemplate', () => {
    it('should create a template with valid input', async () => {
      const input: CreateTemplateInput = {
        documentTypeId,
        name: 'Invoice Template',
        description: 'Template for extracting invoice data',
        rules: [],
        aiEnhanced: false,
      };

      // Mock document type exists
      mockDocTypeRepo.getById.mockResolvedValue({
        documentTypeId,
        customerId,
        name: 'Invoice',
      });

      mockTemplateRepo.put.mockResolvedValue({});

      const result = await service.createTemplate(customerId, input);

      expect(result).toBeDefined();
      expect(result.templateId).toBeDefined();
      expect(result.customerId).toBe(customerId);
      expect(result.documentTypeId).toBe(documentTypeId);
      expect(result.name).toBe(input.name);
      expect(result.description).toBe(input.description);
      expect(result.rules).toEqual([]);
      expect(result.aiEnhanced).toBe(false);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.PK).toBe(generateCustomerPK(customerId));
      expect(result.SK).toContain('TEMPLATE#');
      expect(result.GSI1PK).toBe(generateSK('DOCTYPE', documentTypeId));
      expect(result.GSI1SK).toContain('TEMPLATE#');

      expect(mockTemplateRepo.put).toHaveBeenCalledWith(result);
    });

    it('should create a template with extraction rules', async () => {
      const rules: ExtractionRule[] = [
        {
          ruleId: 'rule-1',
          fieldId: 'field-1',
          method: 'textract_kv',
          params: { keyPattern: 'Invoice Number' } as TextractKVParams,
        },
        {
          ruleId: 'rule-2',
          fieldId: 'field-2',
          method: 'regex',
          params: { pattern: 'Total:\\s*\\$([\\d,]+\\.\\d{2})', captureGroup: 1 } as RegexParams,
        },
      ];

      const input: CreateTemplateInput = {
        documentTypeId,
        name: 'Invoice Template',
        rules,
        aiEnhanced: true,
      };

      mockDocTypeRepo.getById.mockResolvedValue({
        documentTypeId,
        customerId,
        name: 'Invoice',
      });

      mockTemplateRepo.put.mockResolvedValue({});

      const result = await service.createTemplate(customerId, input);

      expect(result.rules).toHaveLength(2);
      expect(result.rules[0].method).toBe('textract_kv');
      expect(result.rules[1].method).toBe('regex');
      expect(result.aiEnhanced).toBe(true);
    });

    it('should throw error if document type does not exist', async () => {
      const input: CreateTemplateInput = {
        documentTypeId: 'nonexistent',
        name: 'Template',
      };

      mockDocTypeRepo.getById.mockResolvedValue(null);

      await expect(service.createTemplate(customerId, input)).rejects.toThrow(
        'Document type nonexistent not found'
      );
    });

    it('should throw error if document type belongs to different customer', async () => {
      const input: CreateTemplateInput = {
        documentTypeId,
        name: 'Template',
      };

      mockDocTypeRepo.getById.mockResolvedValue({
        documentTypeId,
        customerId: 'different-customer',
        name: 'Invoice',
      });

      await expect(service.createTemplate(customerId, input)).rejects.toThrow(
        'Access denied'
      );
    });

    it('should validate extraction rules on create', async () => {
      const input: CreateTemplateInput = {
        documentTypeId,
        name: 'Template',
        rules: [
          {
            ruleId: 'rule-1',
            fieldId: 'field-1',
            method: 'regex',
            params: { pattern: '[invalid(' } as RegexParams, // Invalid regex
          },
        ],
      };

      mockDocTypeRepo.getById.mockResolvedValue({
        documentTypeId,
        customerId,
        name: 'Invoice',
      });

      await expect(service.createTemplate(customerId, input)).rejects.toThrow(
        'Invalid regex pattern'
      );
    });
  });

  describe('getTemplate', () => {
    it('should get a template by ID', async () => {
      const template = {
        PK: generateCustomerPK(customerId),
        SK: generateSK('TEMPLATE', templateId),
        templateId,
        customerId,
        documentTypeId,
        name: 'Invoice Template',
        rules: [],
        aiEnhanced: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockTemplateRepo.getById.mockResolvedValue(template);

      const result = await service.getTemplate(customerId, templateId);

      expect(result).toEqual(template);
      expect(mockTemplateRepo.getById).toHaveBeenCalledWith(customerId, templateId);
    });

    it('should return null if template does not exist', async () => {
      mockTemplateRepo.getById.mockResolvedValue(null);

      const result = await service.getTemplate(customerId, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error if template belongs to different customer', async () => {
      const template = {
        PK: generateCustomerPK('different-customer'),
        SK: generateSK('TEMPLATE', templateId),
        templateId,
        customerId: 'different-customer',
        documentTypeId,
        name: 'Invoice Template',
        rules: [],
        aiEnhanced: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockTemplateRepo.getById.mockResolvedValue(template);

      await expect(service.getTemplate(customerId, templateId)).rejects.toThrow(
        'Access denied'
      );
    });
  });

  describe('listTemplates', () => {
    it('should list all templates for a customer', async () => {
      const templates = [
        {
          templateId: 'template-1',
          customerId,
          documentTypeId: 'doctype-1',
          name: 'Template 1',
          rules: [],
          aiEnhanced: false,
        },
        {
          templateId: 'template-2',
          customerId,
          documentTypeId: 'doctype-2',
          name: 'Template 2',
          rules: [],
          aiEnhanced: true,
        },
      ];

      mockTemplateRepo.getByCustomer.mockResolvedValue({
        items: templates,
        nextToken: undefined,
        count: 2,
      });

      const result = await service.listTemplates(customerId);

      expect(result.items).toHaveLength(2);
      expect(result.items).toEqual(templates);
      expect(result.nextToken).toBeUndefined();
      expect(mockTemplateRepo.getByCustomer).toHaveBeenCalledWith(customerId, {
        limit: undefined,
        nextToken: undefined,
      });
    });

    it('should list templates filtered by document type', async () => {
      const templates = [
        {
          templateId: 'template-1',
          customerId,
          documentTypeId,
          name: 'Template 1',
          rules: [],
          aiEnhanced: false,
        },
        {
          templateId: 'template-2',
          customerId,
          documentTypeId,
          name: 'Template 2',
          rules: [],
          aiEnhanced: true,
        },
      ];

      mockTemplateRepo.getByDocumentType.mockResolvedValue({
        items: templates,
        nextToken: undefined,
        count: 2,
      });

      const result = await service.listTemplates(customerId, { documentTypeId });

      expect(result.items).toHaveLength(2);
      expect(result.items).toEqual(templates);
      expect(mockTemplateRepo.getByDocumentType).toHaveBeenCalledWith(
        documentTypeId,
        { limit: undefined, nextToken: undefined }
      );
    });

    it('should filter out templates from other customers when using GSI', async () => {
      const templates = [
        {
          templateId: 'template-1',
          customerId,
          documentTypeId,
          name: 'Template 1',
          rules: [],
          aiEnhanced: false,
        },
        {
          templateId: 'template-2',
          customerId: 'different-customer',
          documentTypeId,
          name: 'Template 2',
          rules: [],
          aiEnhanced: true,
        },
      ];

      mockTemplateRepo.getByDocumentType.mockResolvedValue({
        items: templates,
        nextToken: undefined,
        count: 2,
      });

      const result = await service.listTemplates(customerId, { documentTypeId });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].customerId).toBe(customerId);
    });

    it('should support pagination', async () => {
      const templates = [
        {
          templateId: 'template-1',
          customerId,
          documentTypeId,
          name: 'Template 1',
          rules: [],
          aiEnhanced: false,
        },
      ];

      mockTemplateRepo.getByCustomer.mockResolvedValue({
        items: templates,
        nextToken: 'next-token-123',
        count: 1,
      });

      const result = await service.listTemplates(customerId, {
        limit: 10,
        nextToken: 'prev-token',
      });

      expect(result.items).toHaveLength(1);
      expect(result.nextToken).toBe('next-token-123');
      expect(mockTemplateRepo.getByCustomer).toHaveBeenCalledWith(customerId, {
        limit: 10,
        nextToken: 'prev-token',
      });
    });
  });

  describe('updateTemplate', () => {
    const existingTemplate = {
      PK: generateCustomerPK(customerId),
      SK: generateSK('TEMPLATE', templateId),
      templateId,
      customerId,
      documentTypeId,
      name: 'Original Template',
      description: 'Original description',
      rules: [],
      aiEnhanced: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should update template name', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const updatedTemplate = {
        ...existingTemplate,
        name: 'Updated Template',
        updatedAt: expect.any(String),
      };

      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);

      const input: UpdateTemplateInput = {
        name: 'Updated Template',
      };

      const result = await service.updateTemplate(customerId, templateId, input);

      expect(result.name).toBe('Updated Template');
      expect(mockTemplateRepo.update).toHaveBeenCalledWith(
        existingTemplate.PK,
        existingTemplate.SK,
        expect.objectContaining({
          name: 'Updated Template',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should update template description', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const updatedTemplate = {
        ...existingTemplate,
        description: 'New description',
        updatedAt: expect.any(String),
      };

      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);

      const input: UpdateTemplateInput = {
        description: 'New description',
      };

      const result = await service.updateTemplate(customerId, templateId, input);

      expect(result.description).toBe('New description');
    });

    it('should update template rules', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const newRules: ExtractionRule[] = [
        {
          ruleId: 'rule-1',
          fieldId: 'field-1',
          method: 'textract_kv',
          params: { keyPattern: 'Invoice Number' } as TextractKVParams,
        },
      ];

      const updatedTemplate = {
        ...existingTemplate,
        rules: newRules,
        updatedAt: expect.any(String),
      };

      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);

      const input: UpdateTemplateInput = {
        rules: newRules,
      };

      const result = await service.updateTemplate(customerId, templateId, input);

      expect(result.rules).toEqual(newRules);
    });

    it('should update aiEnhanced flag', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const updatedTemplate = {
        ...existingTemplate,
        aiEnhanced: true,
        updatedAt: expect.any(String),
      };

      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);

      const input: UpdateTemplateInput = {
        aiEnhanced: true,
      };

      const result = await service.updateTemplate(customerId, templateId, input);

      expect(result.aiEnhanced).toBe(true);
    });

    it('should preserve template ID and creation timestamp', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const updatedTemplate = {
        ...existingTemplate,
        name: 'Updated Template',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);

      const input: UpdateTemplateInput = {
        name: 'Updated Template',
      };

      const result = await service.updateTemplate(customerId, templateId, input);

      expect(result.templateId).toBe(templateId);
      expect(result.createdAt).toBe(existingTemplate.createdAt);
      expect(result.updatedAt).not.toBe(existingTemplate.updatedAt);
    });

    it('should throw error if template does not exist', async () => {
      mockTemplateRepo.getById.mockResolvedValue(null);

      const input: UpdateTemplateInput = {
        name: 'Updated Template',
      };

      await expect(
        service.updateTemplate(customerId, 'nonexistent', input)
      ).rejects.toThrow('Template nonexistent not found');
    });

    it('should throw error if template belongs to different customer', async () => {
      const otherTemplate = {
        ...existingTemplate,
        customerId: 'different-customer',
      };

      mockTemplateRepo.getById.mockResolvedValue(otherTemplate);

      const input: UpdateTemplateInput = {
        name: 'Updated Template',
      };

      await expect(
        service.updateTemplate(customerId, templateId, input)
      ).rejects.toThrow('Access denied');
    });

    it('should validate extraction rules on update', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const input: UpdateTemplateInput = {
        rules: [
          {
            ruleId: 'rule-1',
            fieldId: 'field-1',
            method: 'bbox',
            params: { x: -10, y: 50, width: 100, height: 50 } as BoundingBoxParams, // Invalid x
          },
        ],
      };

      await expect(
        service.updateTemplate(customerId, templateId, input)
      ).rejects.toThrow('Bounding box x must be between 0 and 100');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      const template = {
        PK: generateCustomerPK(customerId),
        SK: generateSK('TEMPLATE', templateId),
        templateId,
        customerId,
        documentTypeId,
        name: 'Template to Delete',
        rules: [],
        aiEnhanced: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockTemplateRepo.getById.mockResolvedValue(template);
      mockTemplateRepo.delete.mockResolvedValue(undefined);

      await service.deleteTemplate(customerId, templateId);

      expect(mockTemplateRepo.delete).toHaveBeenCalledWith(template.PK, template.SK);
    });

    it('should throw error if template does not exist', async () => {
      mockTemplateRepo.getById.mockResolvedValue(null);

      await expect(
        service.deleteTemplate(customerId, 'nonexistent')
      ).rejects.toThrow('Template nonexistent not found');
    });

    it('should throw error if template belongs to different customer', async () => {
      const template = {
        PK: generateCustomerPK('different-customer'),
        SK: generateSK('TEMPLATE', templateId),
        templateId,
        customerId: 'different-customer',
        documentTypeId,
        name: 'Template',
        rules: [],
        aiEnhanced: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockTemplateRepo.getById.mockResolvedValue(template);

      await expect(
        service.deleteTemplate(customerId, templateId)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('validateExtractionRule', () => {
    it('should validate textract_kv rule', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'textract_kv',
        params: { keyPattern: 'Invoice Number', confidence: 0.8 } as TextractKVParams,
      };

      expect(() => validateExtractionRule(rule)).not.toThrow();
    });

    it('should validate regex rule', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'regex',
        params: { pattern: '\\d+', captureGroup: 0, flags: 'i' } as RegexParams,
      };

      expect(() => validateExtractionRule(rule)).not.toThrow();
    });

    it('should validate bounding box rule', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'bbox',
        params: { x: 10, y: 20, width: 30, height: 40, page: 1 } as BoundingBoxParams,
      };

      expect(() => validateExtractionRule(rule)).not.toThrow();
    });

    it('should validate table rule', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'table',
        params: {
          tableIndex: 0,
          columnMapping: { 'Column 1': 'field1', 'Column 2': 'field2' },
        } as TableParams,
      };

      expect(() => validateExtractionRule(rule)).not.toThrow();
    });

    it('should throw error for missing fieldId', () => {
      const rule: any = {
        ruleId: 'rule-1',
        method: 'textract_kv',
        params: { keyPattern: 'Invoice Number' },
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Extraction rule must have a fieldId'
      );
    });

    it('should throw error for invalid method', () => {
      const rule: any = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'invalid_method',
        params: {},
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Invalid extraction method: invalid_method'
      );
    });

    it('should throw error for textract_kv without keyPattern', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'textract_kv',
        params: {} as TextractKVParams,
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Textract KV rule must have a keyPattern'
      );
    });

    it('should throw error for invalid confidence value', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'textract_kv',
        params: { keyPattern: 'Invoice', confidence: 1.5 } as TextractKVParams,
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Confidence must be between 0 and 1'
      );
    });

    it('should throw error for regex without pattern', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'regex',
        params: {} as RegexParams,
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Regex rule must have a pattern'
      );
    });

    it('should throw error for invalid regex pattern', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'regex',
        params: { pattern: '[invalid(' } as RegexParams,
      };

      expect(() => validateExtractionRule(rule)).toThrow('Invalid regex pattern');
    });

    it('should throw error for negative capture group', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'regex',
        params: { pattern: '\\d+', captureGroup: -1 } as RegexParams,
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Capture group must be non-negative'
      );
    });

    it('should throw error for bbox without required coordinates', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'bbox',
        params: { x: 10, y: 20 } as any,
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Bounding box rule must have x, y, width, and height'
      );
    });

    it('should throw error for bbox with out-of-range values', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'bbox',
        params: { x: 150, y: 20, width: 30, height: 40 } as BoundingBoxParams,
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Bounding box x must be between 0 and 100'
      );
    });

    it('should throw error for table without tableIndex', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'table',
        params: { columnMapping: { 'Col1': 'field1' } } as any,
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Table rule must have a tableIndex'
      );
    });

    it('should throw error for table without columnMapping', () => {
      const rule: ExtractionRule = {
        ruleId: 'rule-1',
        fieldId: 'field-1',
        method: 'table',
        params: { tableIndex: 0 } as any,
      };

      expect(() => validateExtractionRule(rule)).toThrow(
        'Table rule must have a columnMapping'
      );
    });

    it('should auto-generate ruleId if missing', () => {
      const rule: any = {
        fieldId: 'field-1',
        method: 'textract_kv',
        params: { keyPattern: 'Invoice Number' },
      };

      validateExtractionRule(rule);

      expect(rule.ruleId).toBeDefined();
      expect(typeof rule.ruleId).toBe('string');
    });
  });

  describe('validateExtractionRules', () => {
    it('should validate array of rules', () => {
      const rules: ExtractionRule[] = [
        {
          ruleId: 'rule-1',
          fieldId: 'field-1',
          method: 'textract_kv',
          params: { keyPattern: 'Invoice Number' } as TextractKVParams,
        },
        {
          ruleId: 'rule-2',
          fieldId: 'field-2',
          method: 'regex',
          params: { pattern: '\\d+' } as RegexParams,
        },
      ];

      expect(() => validateExtractionRules(rules)).not.toThrow();
    });

    it('should throw error if rules is not an array', () => {
      expect(() => validateExtractionRules({} as any)).toThrow(
        'Rules must be an array'
      );
    });

    it('should throw error if any rule is invalid', () => {
      const rules: ExtractionRule[] = [
        {
          ruleId: 'rule-1',
          fieldId: 'field-1',
          method: 'textract_kv',
          params: { keyPattern: 'Invoice Number' } as TextractKVParams,
        },
        {
          ruleId: 'rule-2',
          fieldId: 'field-2',
          method: 'regex',
          params: { pattern: '[invalid(' } as RegexParams, // Invalid regex
        },
      ];

      expect(() => validateExtractionRules(rules)).toThrow('Invalid regex pattern');
    });
  });

  describe('addRule', () => {
    const existingTemplate = {
      PK: generateCustomerPK(customerId),
      SK: generateSK('TEMPLATE', templateId),
      templateId,
      customerId,
      documentTypeId,
      name: 'Invoice Template',
      description: 'Template for invoices',
      rules: [
        {
          ruleId: 'existing-rule-1',
          fieldId: 'field-1',
          method: 'textract_kv' as ExtractionMethod,
          params: { keyPattern: 'Invoice Number' } as TextractKVParams,
        },
      ],
      aiEnhanced: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should add a new rule to template', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const newRule: ExtractionRule = {
        ruleId: 'new-rule-1',
        fieldId: 'field-2',
        method: 'regex',
        params: { pattern: 'Total:\\s*\\$([\\d,]+\\.\\d{2})', captureGroup: 1 } as RegexParams,
      };

      const updatedTemplate = {
        ...existingTemplate,
        rules: [...existingTemplate.rules, newRule],
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);

      const result = await service.addRule(customerId, templateId, newRule);

      expect(result.rules).toHaveLength(2);
      expect(result.rules[1]).toEqual(newRule);
      expect(result.updatedAt).not.toBe(existingTemplate.updatedAt);
      expect(mockTemplateRepo.update).toHaveBeenCalledWith(
        existingTemplate.PK,
        existingTemplate.SK,
        expect.objectContaining({
          rules: expect.arrayContaining([newRule]),
          updatedAt: expect.any(String),
        })
      );
    });

    it('should validate rule before adding', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const invalidRule: ExtractionRule = {
        ruleId: 'invalid-rule',
        fieldId: 'field-2',
        method: 'regex',
        params: { pattern: '[invalid(' } as RegexParams, // Invalid regex
      };

      await expect(
        service.addRule(customerId, templateId, invalidRule)
      ).rejects.toThrow('Invalid regex pattern');
    });

    it('should throw error if rule with same ruleId already exists', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const duplicateRule: ExtractionRule = {
        ruleId: 'existing-rule-1', // Same as existing rule
        fieldId: 'field-2',
        method: 'regex',
        params: { pattern: '\\d+' } as RegexParams,
      };

      await expect(
        service.addRule(customerId, templateId, duplicateRule)
      ).rejects.toThrow('Rule with ID existing-rule-1 already exists in template');
    });

    it('should throw error if template does not exist', async () => {
      mockTemplateRepo.getById.mockResolvedValue(null);

      const newRule: ExtractionRule = {
        ruleId: 'new-rule',
        fieldId: 'field-1',
        method: 'textract_kv',
        params: { keyPattern: 'Invoice' } as TextractKVParams,
      };

      await expect(
        service.addRule(customerId, 'nonexistent', newRule)
      ).rejects.toThrow('Template nonexistent not found');
    });

    it('should throw error if template belongs to different customer', async () => {
      const otherTemplate = {
        ...existingTemplate,
        customerId: 'different-customer',
      };

      mockTemplateRepo.getById.mockResolvedValue(otherTemplate);

      const newRule: ExtractionRule = {
        ruleId: 'new-rule',
        fieldId: 'field-1',
        method: 'textract_kv',
        params: { keyPattern: 'Invoice' } as TextractKVParams,
      };

      await expect(
        service.addRule(customerId, templateId, newRule)
      ).rejects.toThrow('Access denied');
    });

    it('should add rule with all extraction method types', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      // Test textract_kv
      const kvRule: ExtractionRule = {
        ruleId: 'kv-rule',
        fieldId: 'field-kv',
        method: 'textract_kv',
        params: { keyPattern: 'Total Amount', confidence: 0.9 } as TextractKVParams,
      };

      mockTemplateRepo.update.mockResolvedValue({
        ...existingTemplate,
        rules: [...existingTemplate.rules, kvRule],
      });

      await service.addRule(customerId, templateId, kvRule);

      // Test bbox
      const bboxRule: ExtractionRule = {
        ruleId: 'bbox-rule',
        fieldId: 'field-bbox',
        method: 'bbox',
        params: { x: 10, y: 20, width: 30, height: 40, page: 1 } as BoundingBoxParams,
      };

      mockTemplateRepo.update.mockResolvedValue({
        ...existingTemplate,
        rules: [...existingTemplate.rules, bboxRule],
      });

      await service.addRule(customerId, templateId, bboxRule);

      // Test table
      const tableRule: ExtractionRule = {
        ruleId: 'table-rule',
        fieldId: 'field-table',
        method: 'table',
        params: {
          tableIndex: 0,
          columnMapping: { 'Item': 'item_name', 'Price': 'item_price' },
        } as TableParams,
      };

      mockTemplateRepo.update.mockResolvedValue({
        ...existingTemplate,
        rules: [...existingTemplate.rules, tableRule],
      });

      const result = await service.addRule(customerId, templateId, tableRule);

      expect(result).toBeDefined();
    });
  });

  describe('removeRule', () => {
    const existingTemplate = {
      PK: generateCustomerPK(customerId),
      SK: generateSK('TEMPLATE', templateId),
      templateId,
      customerId,
      documentTypeId,
      name: 'Invoice Template',
      description: 'Template for invoices',
      rules: [
        {
          ruleId: 'rule-1',
          fieldId: 'field-1',
          method: 'textract_kv' as ExtractionMethod,
          params: { keyPattern: 'Invoice Number' } as TextractKVParams,
        },
        {
          ruleId: 'rule-2',
          fieldId: 'field-2',
          method: 'regex' as ExtractionMethod,
          params: { pattern: '\\d+' } as RegexParams,
        },
        {
          ruleId: 'rule-3',
          fieldId: 'field-3',
          method: 'bbox' as ExtractionMethod,
          params: { x: 10, y: 20, width: 30, height: 40 } as BoundingBoxParams,
        },
      ],
      aiEnhanced: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should remove a rule from template', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const updatedTemplate = {
        ...existingTemplate,
        rules: existingTemplate.rules.filter(r => r.ruleId !== 'rule-2'),
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);

      const result = await service.removeRule(customerId, templateId, 'rule-2');

      expect(result.rules).toHaveLength(2);
      expect(result.rules.find(r => r.ruleId === 'rule-2')).toBeUndefined();
      expect(result.rules.find(r => r.ruleId === 'rule-1')).toBeDefined();
      expect(result.rules.find(r => r.ruleId === 'rule-3')).toBeDefined();
      expect(result.updatedAt).not.toBe(existingTemplate.updatedAt);
      expect(mockTemplateRepo.update).toHaveBeenCalledWith(
        existingTemplate.PK,
        existingTemplate.SK,
        expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({ ruleId: 'rule-1' }),
            expect.objectContaining({ ruleId: 'rule-3' }),
          ]),
          updatedAt: expect.any(String),
        })
      );
    });

    it('should throw error if rule does not exist', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      await expect(
        service.removeRule(customerId, templateId, 'nonexistent-rule')
      ).rejects.toThrow('Rule with ID nonexistent-rule not found in template');
    });

    it('should throw error if template does not exist', async () => {
      mockTemplateRepo.getById.mockResolvedValue(null);

      await expect(
        service.removeRule(customerId, 'nonexistent', 'rule-1')
      ).rejects.toThrow('Template nonexistent not found');
    });

    it('should throw error if template belongs to different customer', async () => {
      const otherTemplate = {
        ...existingTemplate,
        customerId: 'different-customer',
      };

      mockTemplateRepo.getById.mockResolvedValue(otherTemplate);

      await expect(
        service.removeRule(customerId, templateId, 'rule-1')
      ).rejects.toThrow('Access denied');
    });

    it('should remove the last rule from template', async () => {
      const templateWithOneRule = {
        ...existingTemplate,
        rules: [existingTemplate.rules[0]],
      };

      mockTemplateRepo.getById.mockResolvedValue(templateWithOneRule);

      const updatedTemplate = {
        ...templateWithOneRule,
        rules: [],
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);

      const result = await service.removeRule(customerId, templateId, 'rule-1');

      expect(result.rules).toHaveLength(0);
    });

    it('should update timestamp when removing rule', async () => {
      mockTemplateRepo.getById.mockResolvedValue(existingTemplate);

      const updatedTemplate = {
        ...existingTemplate,
        rules: existingTemplate.rules.filter(r => r.ruleId !== 'rule-1'),
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);

      const result = await service.removeRule(customerId, templateId, 'rule-1');

      expect(result.updatedAt).not.toBe(existingTemplate.updatedAt);
      expect(mockTemplateRepo.update).toHaveBeenCalledWith(
        existingTemplate.PK,
        existingTemplate.SK,
        expect.objectContaining({
          updatedAt: expect.any(String),
        })
      );
    });
  });
});
