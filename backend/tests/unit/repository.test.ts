// Unit Tests for Base Repository and Data Access Layer
// Phase 2: Document Type & Template Management

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseRepository,
  DocumentTypeRepository,
  TemplateRepository,
  DocumentRepository,
  generateCustomerPK,
  generateSK,
  extractIdFromSK,
  validateTenantAccess,
  filterByCustomer,
} from '../../lambdas/layers/shared/nodejs/repository';

// Mock DynamoDB client
vi.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = vi.fn();
  return {
    DynamoDBDocumentClient: {
      from: vi.fn(() => ({ send: mockSend })),
    },
    PutCommand: vi.fn(),
    GetCommand: vi.fn(),
    QueryCommand: vi.fn(),
    UpdateCommand: vi.fn(),
    DeleteCommand: vi.fn(),
    BatchWriteCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

describe('Tenant Isolation Helpers', () => {
  describe('generateCustomerPK', () => {
    it('should generate partition key with CUSTOMER prefix', () => {
      const customerId = 'cust-123';
      const pk = generateCustomerPK(customerId);
      expect(pk).toBe('CUSTOMER#cust-123');
    });

    it('should handle different customer ID formats', () => {
      expect(generateCustomerPK('abc')).toBe('CUSTOMER#abc');
      expect(generateCustomerPK('123-456-789')).toBe('CUSTOMER#123-456-789');
      expect(generateCustomerPK('uuid-v4-format')).toBe('CUSTOMER#uuid-v4-format');
    });
  });

  describe('generateSK', () => {
    it('should generate sort key with prefix and ID', () => {
      const sk = generateSK('DOCTYPE', 'dt-456');
      expect(sk).toBe('DOCTYPE#dt-456');
    });

    it('should handle different prefixes', () => {
      expect(generateSK('TEMPLATE', 'tmpl-789')).toBe('TEMPLATE#tmpl-789');
      expect(generateSK('DOCUMENT', 'doc-999')).toBe('DOCUMENT#doc-999');
    });
  });

  describe('extractIdFromSK', () => {
    it('should extract ID from sort key', () => {
      const id = extractIdFromSK('DOCTYPE#dt-456');
      expect(id).toBe('dt-456');
    });

    it('should handle multiple hash separators', () => {
      expect(extractIdFromSK('STATUS#completed#DOCUMENT#doc-999')).toBe('doc-999');
    });

    it('should handle single part keys', () => {
      expect(extractIdFromSK('simple-id')).toBe('simple-id');
    });
  });

  describe('validateTenantAccess', () => {
    it('should not throw when customer IDs match', () => {
      expect(() => {
        validateTenantAccess('cust-123', 'cust-123');
      }).not.toThrow();
    });

    it('should throw when customer IDs do not match', () => {
      expect(() => {
        validateTenantAccess('cust-123', 'cust-456');
      }).toThrow('Access denied: Resource does not belong to customer');
    });

    it('should be case-sensitive', () => {
      expect(() => {
        validateTenantAccess('cust-123', 'CUST-123');
      }).toThrow();
    });
  });

  describe('filterByCustomer', () => {
    it('should filter items by customer ID', () => {
      const items = [
        { PK: 'CUSTOMER#cust-123', SK: 'DOCTYPE#dt-1', name: 'Type 1' },
        { PK: 'CUSTOMER#cust-456', SK: 'DOCTYPE#dt-2', name: 'Type 2' },
        { PK: 'CUSTOMER#cust-123', SK: 'DOCTYPE#dt-3', name: 'Type 3' },
      ];

      const filtered = filterByCustomer(items, 'cust-123');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe('Type 1');
      expect(filtered[1].name).toBe('Type 3');
    });

    it('should return empty array when no matches', () => {
      const items = [
        { PK: 'CUSTOMER#cust-456', SK: 'DOCTYPE#dt-1', name: 'Type 1' },
      ];

      const filtered = filterByCustomer(items, 'cust-123');
      expect(filtered).toHaveLength(0);
    });

    it('should return all items when all match', () => {
      const items = [
        { PK: 'CUSTOMER#cust-123', SK: 'DOCTYPE#dt-1', name: 'Type 1' },
        { PK: 'CUSTOMER#cust-123', SK: 'DOCTYPE#dt-2', name: 'Type 2' },
      ];

      const filtered = filterByCustomer(items, 'cust-123');
      expect(filtered).toHaveLength(2);
    });
  });
});

describe('BaseRepository', () => {
  let repository: BaseRepository<any>;

  beforeEach(() => {
    repository = new BaseRepository('TestTable');
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use provided table name', () => {
      const repo = new BaseRepository('CustomTable');
      expect(repo['tableName']).toBe('CustomTable');
    });

    it('should use default table name from environment', () => {
      const repo = new BaseRepository();
      expect(repo['tableName']).toBe('DocumentPlatform');
    });
  });

  describe('update', () => {
    it('should throw error when no valid fields to update', async () => {
      await expect(
        repository.update('PK#123', 'SK#456', { PK: 'new-pk', SK: 'new-sk' })
      ).rejects.toThrow('No valid fields to update');
    });
  });
});

describe('DocumentTypeRepository', () => {
  let repository: DocumentTypeRepository;

  beforeEach(() => {
    repository = new DocumentTypeRepository('TestTable');
    vi.clearAllMocks();
  });

  describe('getByCustomer', () => {
    it('should query with correct PK and SK prefix', async () => {
      const querySpy = vi.spyOn(repository, 'query').mockResolvedValue({
        items: [],
        count: 0,
      });

      await repository.getByCustomer('cust-123');

      expect(querySpy).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'DOCTYPE#',
        {}
      );
    });

    it('should pass through query options', async () => {
      const querySpy = vi.spyOn(repository, 'query').mockResolvedValue({
        items: [],
        count: 0,
      });

      const options = { limit: 10, scanIndexForward: false };
      await repository.getByCustomer('cust-123', options);

      expect(querySpy).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'DOCTYPE#',
        options
      );
    });
  });

  describe('getById', () => {
    it('should get with correct PK and SK', async () => {
      const getSpy = vi.spyOn(repository, 'get').mockResolvedValue(null);

      await repository.getById('cust-123', 'dt-456');

      expect(getSpy).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'DOCTYPE#dt-456'
      );
    });
  });
});

describe('TemplateRepository', () => {
  let repository: TemplateRepository;

  beforeEach(() => {
    repository = new TemplateRepository('TestTable');
    vi.clearAllMocks();
  });

  describe('getByCustomer', () => {
    it('should query with correct PK and SK prefix', async () => {
      const querySpy = vi.spyOn(repository, 'query').mockResolvedValue({
        items: [],
        count: 0,
      });

      await repository.getByCustomer('cust-123');

      expect(querySpy).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'TEMPLATE#',
        {}
      );
    });
  });

  describe('getByDocumentType', () => {
    it('should query GSI1 with correct keys', async () => {
      const queryGSI1Spy = vi.spyOn(repository, 'queryGSI1').mockResolvedValue({
        items: [],
        count: 0,
      });

      await repository.getByDocumentType('dt-456');

      expect(queryGSI1Spy).toHaveBeenCalledWith(
        'DOCTYPE#dt-456',
        'TEMPLATE#',
        {}
      );
    });
  });

  describe('getById', () => {
    it('should get with correct PK and SK', async () => {
      const getSpy = vi.spyOn(repository, 'get').mockResolvedValue(null);

      await repository.getById('cust-123', 'tmpl-789');

      expect(getSpy).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'TEMPLATE#tmpl-789'
      );
    });
  });
});

describe('DocumentRepository', () => {
  let repository: DocumentRepository;

  beforeEach(() => {
    repository = new DocumentRepository('TestTable');
    vi.clearAllMocks();
  });

  describe('getByCustomer', () => {
    it('should query with correct PK and SK prefix', async () => {
      const querySpy = vi.spyOn(repository, 'query').mockResolvedValue({
        items: [],
        count: 0,
      });

      await repository.getByCustomer('cust-123');

      expect(querySpy).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'DOCUMENT#',
        {}
      );
    });
  });

  describe('getByStatus', () => {
    it('should query GSI2 with correct keys', async () => {
      const queryGSI2Spy = vi.spyOn(repository, 'queryGSI2').mockResolvedValue({
        items: [],
        count: 0,
      });

      await repository.getByStatus('cust-123', 'completed');

      expect(queryGSI2Spy).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'STATUS#completed',
        {}
      );
    });
  });

  describe('getById', () => {
    it('should get with correct PK and SK', async () => {
      const getSpy = vi.spyOn(repository, 'get').mockResolvedValue(null);

      await repository.getById('cust-123', 'doc-999');

      expect(getSpy).toHaveBeenCalledWith(
        'CUSTOMER#cust-123',
        'DOCUMENT#doc-999'
      );
    });
  });
});

describe('Data Model Key Generation', () => {
  it('should generate consistent keys for document types', () => {
    const customerId = 'cust-123';
    const documentTypeId = 'dt-456';
    
    const pk = generateCustomerPK(customerId);
    const sk = generateSK('DOCTYPE', documentTypeId);
    
    expect(pk).toBe('CUSTOMER#cust-123');
    expect(sk).toBe('DOCTYPE#dt-456');
  });

  it('should generate consistent keys for templates', () => {
    const customerId = 'cust-123';
    const templateId = 'tmpl-789';
    const documentTypeId = 'dt-456';
    
    const pk = generateCustomerPK(customerId);
    const sk = generateSK('TEMPLATE', templateId);
    const gsi1pk = generateSK('DOCTYPE', documentTypeId);
    const gsi1sk = generateSK('TEMPLATE', templateId);
    
    expect(pk).toBe('CUSTOMER#cust-123');
    expect(sk).toBe('TEMPLATE#tmpl-789');
    expect(gsi1pk).toBe('DOCTYPE#dt-456');
    expect(gsi1sk).toBe('TEMPLATE#tmpl-789');
  });

  it('should generate consistent keys for documents', () => {
    const customerId = 'cust-123';
    const documentId = 'doc-999';
    const status = 'completed';
    
    const pk = generateCustomerPK(customerId);
    const sk = generateSK('DOCUMENT', documentId);
    const gsi2pk = generateCustomerPK(customerId);
    const gsi2sk = `STATUS#${status}#DOCUMENT#${documentId}`;
    
    expect(pk).toBe('CUSTOMER#cust-123');
    expect(sk).toBe('DOCUMENT#doc-999');
    expect(gsi2pk).toBe('CUSTOMER#cust-123');
    expect(gsi2sk).toBe('STATUS#completed#DOCUMENT#doc-999');
  });
});
