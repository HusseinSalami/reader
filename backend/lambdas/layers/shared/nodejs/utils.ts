// Multi-Tenant Document Platform - Shared Utilities

import { ApiResponse, AuthContext } from './types';

/**
 * Create a successful API response
 */
export function successResponse<T>(data: T, statusCode: number = 200): any {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      success: true,
      data,
    } as ApiResponse<T>),
  };
}

/**
 * Create an error API response
 */
export function errorResponse(
  code: string,
  message: string,
  statusCode: number = 400
): any {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      success: false,
      error: {
        code,
        message,
      },
    } as ApiResponse),
  };
}

/**
 * Extract auth context from Lambda event
 */
export function getAuthContext(event: any): AuthContext {
  const authorizer = event.requestContext?.authorizer;
  
  if (!authorizer) {
    throw new Error('No authorization context found');
  }

  return {
    customerId: authorizer.customerId,
    userId: authorizer.userId,
    role: authorizer.role,
    email: authorizer.email,
  };
}

/**
 * Validate customer access to resource
 */
export function validateCustomerAccess(
  resourceCustomerId: string,
  authContext: AuthContext
): void {
  if (resourceCustomerId !== authContext.customerId) {
    throw new Error('Access denied: Customer mismatch');
  }
}

/**
 * Generate sort key for DynamoDB
 */
export function generateSortKey(prefix: string, ...parts: string[]): string {
  return `${prefix}#${parts.join('#')}`;
}

/**
 * Parse sort key
 */
export function parseSortKey(sk: string): string[] {
  return sk.split('#');
}

/**
 * Generate ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Generate TTL timestamp (30 days from now)
 */
export function ttl30Days(): number {
  return Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Generate S3 key for customer document
 */
export function generateS3Key(
  customerId: string,
  documentId: string,
  filename: string
): string {
  const sanitized = sanitizeFilename(filename);
  return `${customerId}/documents/${documentId}/${sanitized}`;
}

/**
 * Calculate confidence score
 */
export function calculateOverallConfidence(
  fieldConfidences: Record<string, number>
): number {
  const values = Object.values(fieldConfidences);
  if (values.length === 0) return 0;
  
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Determine if document needs review based on confidence
 */
export function needsReview(overallConfidence: number, threshold: number = 0.85): boolean {
  return overallConfidence < threshold;
}

/**
 * Get subscription tier limits
 */
export function getTierLimits(tier: 'FREE' | 'PRO' | 'ENTERPRISE') {
  switch (tier) {
    case 'FREE':
      return {
        maxDocumentsPerMonth: 100,
        maxUsers: 1,
        apiEnabled: false,
        webhooksEnabled: false,
        mlEnabled: false,
        languageSupport: ['en'],
      };
    case 'PRO':
      return {
        maxDocumentsPerMonth: 1000,
        maxUsers: 5,
        apiEnabled: true,
        webhooksEnabled: true,
        mlEnabled: false,
        languageSupport: ['en', 'fr', 'ar'],
      };
    case 'ENTERPRISE':
      return {
        maxDocumentsPerMonth: -1, // Unlimited
        maxUsers: -1, // Unlimited
        apiEnabled: true,
        webhooksEnabled: true,
        mlEnabled: true,
        languageSupport: ['en', 'fr', 'ar'],
      };
  }
}

/**
 * Validate tier limits
 */
export function validateTierLimit(
  currentUsage: number,
  limit: number,
  resourceName: string
): void {
  if (limit === -1) return; // Unlimited
  
  if (currentUsage >= limit) {
    throw new Error(`${resourceName} limit exceeded for subscription tier`);
  }
}
