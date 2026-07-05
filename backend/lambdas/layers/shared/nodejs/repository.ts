// Document Type & Template Management - Base Repository
// Phase 2: Multi-Tenant Document Platform

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
  QueryCommandInput,
  PutCommandInput,
  GetCommandInput,
  DeleteCommandInput,
} from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Table name from environment variable
const TABLE_NAME = process.env.TABLE_NAME || 'DocumentPlatform';

// ========================================
// Base Repository Interface
// ========================================

export interface BaseItem {
  PK: string;
  SK: string;
  [key: string]: any;
}

export interface QueryOptions {
  limit?: number;
  nextToken?: string;
  scanIndexForward?: boolean;
  filterExpression?: string;
  expressionAttributeValues?: Record<string, any>;
  expressionAttributeNames?: Record<string, string>;
}

export interface QueryResult<T> {
  items: T[];
  nextToken?: string;
  count: number;
}

// ========================================
// Tenant Isolation Helpers
// ========================================

/**
 * Generate partition key with customer prefix for tenant isolation
 */
export function generateCustomerPK(customerId: string): string {
  return `CUSTOMER#${customerId}`;
}

/**
 * Generate sort key with prefix and ID
 */
export function generateSK(prefix: string, id: string): string {
  return `${prefix}#${id}`;
}

/**
 * Extract ID from sort key
 */
export function extractIdFromSK(sk: string): string {
  const parts = sk.split('#');
  return parts[parts.length - 1];
}

/**
 * Validate that resource belongs to customer (tenant isolation check)
 */
export function validateTenantAccess(
  resourceCustomerId: string,
  requestCustomerId: string
): void {
  if (resourceCustomerId !== requestCustomerId) {
    throw new Error('Access denied: Resource does not belong to customer');
  }
}

/**
 * Filter items by customer ID (tenant isolation)
 */
export function filterByCustomer<T extends BaseItem>(
  items: T[],
  customerId: string
): T[] {
  const customerPK = generateCustomerPK(customerId);
  return items.filter(item => item.PK === customerPK);
}

// ========================================
// Base Repository Class
// ========================================

export class BaseRepository<T extends BaseItem> {
  protected tableName: string;

  constructor(tableName: string = TABLE_NAME) {
    this.tableName = tableName;
  }

  /**
   * Create or update an item
   */
  async put(item: T): Promise<T> {
    const params: PutCommandInput = {
      TableName: this.tableName,
      Item: item,
    };

    await docClient.send(new PutCommand(params));
    return item;
  }

  /**
   * Get an item by PK and SK
   */
  async get(pk: string, sk: string): Promise<T | null> {
    const params: GetCommandInput = {
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
    };

    const result = await docClient.send(new GetCommand(params));
    return (result.Item as T) || null;
  }

  /**
   * Query items by PK with optional SK prefix
   */
  async query(
    pk: string,
    skPrefix?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    let keyConditionExpression = 'PK = :pk';
    const expressionAttributeValues: Record<string, any> = {
      ':pk': pk,
    };

    if (skPrefix) {
      keyConditionExpression += ' AND begins_with(SK, :skPrefix)';
      expressionAttributeValues[':skPrefix'] = skPrefix;
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ...options.expressionAttributeValues,
      },
      Limit: options.limit,
      ExclusiveStartKey: options.nextToken
        ? JSON.parse(Buffer.from(options.nextToken, 'base64').toString())
        : undefined,
      ScanIndexForward: options.scanIndexForward !== false,
      FilterExpression: options.filterExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
    };

    const result = await docClient.send(new QueryCommand(params));

    return {
      items: (result.Items as T[]) || [],
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
      count: result.Count || 0,
    };
  }

  /**
   * Query items using GSI1
   */
  async queryGSI1(
    gsi1pk: string,
    gsi1skPrefix?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    let keyConditionExpression = 'GSI1PK = :gsi1pk';
    const expressionAttributeValues: Record<string, any> = {
      ':gsi1pk': gsi1pk,
    };

    if (gsi1skPrefix) {
      keyConditionExpression += ' AND begins_with(GSI1SK, :gsi1skPrefix)';
      expressionAttributeValues[':gsi1skPrefix'] = gsi1skPrefix;
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ...options.expressionAttributeValues,
      },
      Limit: options.limit,
      ExclusiveStartKey: options.nextToken
        ? JSON.parse(Buffer.from(options.nextToken, 'base64').toString())
        : undefined,
      ScanIndexForward: options.scanIndexForward !== false,
      FilterExpression: options.filterExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
    };

    const result = await docClient.send(new QueryCommand(params));

    return {
      items: (result.Items as T[]) || [],
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
      count: result.Count || 0,
    };
  }

  /**
   * Query items using GSI2
   */
  async queryGSI2(
    gsi2pk: string,
    gsi2skPrefix?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    let keyConditionExpression = 'GSI2PK = :gsi2pk';
    const expressionAttributeValues: Record<string, any> = {
      ':gsi2pk': gsi2pk,
    };

    if (gsi2skPrefix) {
      keyConditionExpression += ' AND begins_with(GSI2SK, :gsi2skPrefix)';
      expressionAttributeValues[':gsi2skPrefix'] = gsi2skPrefix;
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ...options.expressionAttributeValues,
      },
      Limit: options.limit,
      ExclusiveStartKey: options.nextToken
        ? JSON.parse(Buffer.from(options.nextToken, 'base64').toString())
        : undefined,
      ScanIndexForward: options.scanIndexForward !== false,
      FilterExpression: options.filterExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
    };

    const result = await docClient.send(new QueryCommand(params));

    return {
      items: (result.Items as T[]) || [],
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
      count: result.Count || 0,
    };
  }

  /**
   * Update an item with partial data
   */
  async update(
    pk: string,
    sk: string,
    updates: Partial<T>
  ): Promise<T> {
    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    let index = 0;
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'PK' && key !== 'SK') {
        const nameKey = `#attr${index}`;
        const valueKey = `:val${index}`;
        updateExpressions.push(`${nameKey} = ${valueKey}`);
        expressionAttributeNames[nameKey] = key;
        expressionAttributeValues[valueKey] = value;
        index++;
      }
    }

    if (updateExpressions.length === 0) {
      throw new Error('No valid fields to update');
    }

    const params = {
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW' as const,
    };

    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes as T;
  }

  /**
   * Delete an item
   */
  async delete(pk: string, sk: string): Promise<void> {
    const params: DeleteCommandInput = {
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
    };

    await docClient.send(new DeleteCommand(params));
  }

  /**
   * Batch delete items (for cascading deletes)
   */
  async batchDelete(items: Array<{ PK: string; SK: string }>): Promise<void> {
    if (items.length === 0) return;

    // DynamoDB batch write supports max 25 items
    const batches: Array<Array<{ PK: string; SK: string }>> = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    for (const batch of batches) {
      const params = {
        RequestItems: {
          [this.tableName]: batch.map(item => ({
            DeleteRequest: {
              Key: item,
            },
          })),
        },
      };

      await docClient.send(new BatchWriteCommand(params));
    }
  }

  /**
   * Check if item exists
   */
  async exists(pk: string, sk: string): Promise<boolean> {
    const item = await this.get(pk, sk);
    return item !== null;
  }
}

// ========================================
// Specialized Repository Classes
// ========================================

/**
 * Repository for Document Types with tenant isolation
 */
export class DocumentTypeRepository extends BaseRepository<any> {
  /**
   * Get all document types for a customer
   */
  async getByCustomer(customerId: string, options: QueryOptions = {}) {
    const pk = generateCustomerPK(customerId);
    return this.query(pk, 'DOCTYPE#', options);
  }

  /**
   * Get a specific document type
   */
  async getById(customerId: string, documentTypeId: string) {
    const pk = generateCustomerPK(customerId);
    const sk = generateSK('DOCTYPE', documentTypeId);
    return this.get(pk, sk);
  }

  /**
   * Delete document type and cascade to templates and documents
   */
  async deleteWithCascade(customerId: string, documentTypeId: string): Promise<void> {
    const pk = generateCustomerPK(customerId);
    const sk = generateSK('DOCTYPE', documentTypeId);

    // Delete the document type
    await this.delete(pk, sk);

    // Query and delete associated templates
    const templates = await this.query(pk, 'TEMPLATE#');
    const templatesToDelete = templates.items.filter(
      (t: any) => t.documentTypeId === documentTypeId
    );
    
    if (templatesToDelete.length > 0) {
      await this.batchDelete(
        templatesToDelete.map(t => ({ PK: t.PK, SK: t.SK }))
      );
    }

    // Query and delete associated documents
    const documents = await this.query(pk, 'DOCUMENT#');
    const documentsToDelete = documents.items.filter(
      (d: any) => d.documentTypeId === documentTypeId
    );
    
    if (documentsToDelete.length > 0) {
      await this.batchDelete(
        documentsToDelete.map(d => ({ PK: d.PK, SK: d.SK }))
      );
    }
  }
}

/**
 * Repository for Templates with tenant isolation
 */
export class TemplateRepository extends BaseRepository<any> {
  /**
   * Get all templates for a customer
   */
  async getByCustomer(customerId: string, options: QueryOptions = {}) {
    const pk = generateCustomerPK(customerId);
    return this.query(pk, 'TEMPLATE#', options);
  }

  /**
   * Get templates by document type
   */
  async getByDocumentType(documentTypeId: string, options: QueryOptions = {}) {
    const gsi1pk = generateSK('DOCTYPE', documentTypeId);
    return this.queryGSI1(gsi1pk, 'TEMPLATE#', options);
  }

  /**
   * Get a specific template
   */
  async getById(customerId: string, templateId: string) {
    const pk = generateCustomerPK(customerId);
    const sk = generateSK('TEMPLATE', templateId);
    return this.get(pk, sk);
  }
}

/**
 * Repository for Documents with tenant isolation
 */
export class DocumentRepository extends BaseRepository<any> {
  /**
   * Get all documents for a customer
   */
  async getByCustomer(customerId: string, options: QueryOptions = {}) {
    const pk = generateCustomerPK(customerId);
    return this.query(pk, 'DOCUMENT#', options);
  }

  /**
   * Get documents by status
   */
  async getByStatus(customerId: string, status: string, options: QueryOptions = {}) {
    const gsi2pk = generateCustomerPK(customerId);
    const gsi2skPrefix = generateSK('STATUS', status);
    return this.queryGSI2(gsi2pk, gsi2skPrefix, options);
  }

  /**
   * Get a specific document
   */
  async getById(customerId: string, documentId: string) {
    const pk = generateCustomerPK(customerId);
    const sk = generateSK('DOCUMENT', documentId);
    return this.get(pk, sk);
  }
}
