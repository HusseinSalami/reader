// Document Upload Lambda Handler - Unit Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the service module with a factory
vi.mock('./service', () => {
  const mockUploadDocument = vi.fn();
  return {
    DocumentService: class {
      uploadDocument = mockUploadDocument;
    },
    __mockUploadDocument: mockUploadDocument,
  };
});

// Import handler and mock after mocking
import { handler } from './upload';
import { __mockUploadDocument as mockUploadDocument } from './service';

describe('Document Upload Lambda Handler', () => {
  beforeEach(() => {
    mockUploadDocument.mockClear();
  });

  const createEvent = (body: any, customerId = 'cust-123'): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    requestContext: {
      authorizer: {
        customerId,
        userId: 'user-456',
        role: 'ADMIN',
        email: 'test@example.com',
      },
    } as any,
  } as any);

  it('should upload document successfully', async () => {
    const fileContent = Buffer.from('test content').toString('base64');
    const event = createEvent({
      documentTypeId: 'dt-123',
      filename: 'test.pdf',
      fileContent,
    });

    mockUploadDocument.mockResolvedValue({
      documentId: 'doc-789',
      s3Key: 'customers/cust-123/documents/doc-789.pdf',
      uploadedAt: '2024-01-15T10:00:00Z',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual({
      success: true,
      data: {
        documentId: 'doc-789',
        s3Key: 'customers/cust-123/documents/doc-789.pdf',
        uploadedAt: '2024-01-15T10:00:00Z',
      },
    });
  });

  it('should return 400 when body is missing', async () => {
    const event = { requestContext: { authorizer: {} } } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      success: false,
      error: {
        code: 'MISSING_BODY',
        message: 'Request body is required',
      },
    });
  });

  it('should return 400 when documentTypeId is missing', async () => {
    const event = createEvent({
      filename: 'test.pdf',
      fileContent: 'base64content',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      success: false,
      error: {
        code: 'MISSING_FIELD',
        message: 'documentTypeId is required',
      },
    });
  });

  it('should return 400 when filename is missing', async () => {
    const event = createEvent({
      documentTypeId: 'dt-123',
      fileContent: 'base64content',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      success: false,
      error: {
        code: 'MISSING_FIELD',
        message: 'filename is required',
      },
    });
  });

  it('should return 400 when fileContent is missing', async () => {
    const event = createEvent({
      documentTypeId: 'dt-123',
      filename: 'test.pdf',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      success: false,
      error: {
        code: 'MISSING_FIELD',
        message: 'fileContent is required',
      },
    });
  });

  it('should return 400 for unsupported file format', async () => {
    const event = createEvent({
      documentTypeId: 'dt-123',
      filename: 'test.docx',
      fileContent: 'base64content',
    });

    mockUploadDocument.mockRejectedValue(
      new Error('Unsupported file format: docx')
    );

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Unsupported file format: docx',
      },
    });
  });

  it('should return 400 for file too large', async () => {
    const event = createEvent({
      documentTypeId: 'dt-123',
      filename: 'test.pdf',
      fileContent: 'base64content',
    });

    mockUploadDocument.mockRejectedValue(
      new Error('File size exceeds maximum allowed size of 10MB')
    );

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds maximum allowed size of 10MB',
      },
    });
  });

  it('should include templateId when provided', async () => {
    const event = createEvent({
      documentTypeId: 'dt-123',
      templateId: 'tmpl-456',
      filename: 'test.pdf',
      fileContent: 'base64content',
    });

    mockUploadDocument.mockResolvedValue({
      documentId: 'doc-789',
      s3Key: 'customers/cust-123/documents/doc-789.pdf',
      uploadedAt: '2024-01-15T10:00:00Z',
    });

    await handler(event);

    expect(mockUploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'tmpl-456',
      })
    );
  });

  it('should include language when provided', async () => {
    const event = createEvent({
      documentTypeId: 'dt-123',
      filename: 'test.pdf',
      fileContent: 'base64content',
      language: 'fr',
    });

    mockUploadDocument.mockResolvedValue({
      documentId: 'doc-789',
      s3Key: 'customers/cust-123/documents/doc-789.pdf',
      uploadedAt: '2024-01-15T10:00:00Z',
    });

    await handler(event);

    expect(mockUploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'fr',
      })
    );
  });

  it('should return 500 for unexpected errors', async () => {
    const event = createEvent({
      documentTypeId: 'dt-123',
      filename: 'test.pdf',
      fileContent: 'base64content',
    });

    mockUploadDocument.mockRejectedValue(new Error('Database connection failed'));

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Database connection failed',
      },
    });
  });
});
