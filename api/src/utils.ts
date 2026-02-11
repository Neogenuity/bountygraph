/**
 * BountyGraph API Utilities
 * Validation, error handling, and helper functions
 */

import { Response } from 'express';

// ============ Error Types ============

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_SOLANA_KEY = 'INVALID_SOLANA_KEY',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============ Validation Functions ============

/**
 * Validate that a string is a valid Solana public key
 */
export function isValidSolanaKey(key: string): boolean {
  // Solana keys are 44 characters (32 bytes base58)
  if (!key || key.length !== 44) return false;
  try {
    // Basic base58 validation
    const base58regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    return base58regex.test(key);
  } catch {
    return false;
  }
}

/**
 * Validate that a string is a valid SHA-256 hash (hex or base64)
 */
export function isValidHash(hash: string): boolean {
  if (!hash) return false;
  // Hex: 64 chars, or base64: 44 chars
  const hexRegex = /^[a-f0-9]{64}$/i;
  const base64Regex = /^[A-Za-z0-9+/]{43}=$/;
  return hexRegex.test(hash) || base64Regex.test(hash);
}

/**
 * Validate bounty request parameters
 */
export function validateBountyRequest(data: any): string | null {
  if (!data.bountyId || typeof data.bountyId !== 'string') {
    return 'bountyId is required and must be a string';
  }
  if (!data.title || typeof data.title !== 'string') {
    return 'title is required and must be a string';
  }
  if (!data.totalAmount || typeof data.totalAmount !== 'number' || data.totalAmount <= 0) {
    return 'totalAmount is required, must be a number, and must be > 0';
  }
  if (!Number.isInteger(data.milestoneCount) || data.milestoneCount < 1 || data.milestoneCount > 10) {
    return 'milestoneCount must be an integer between 1 and 10';
  }
  if (data.creatorWallet && !isValidSolanaKey(data.creatorWallet)) {
    return 'creatorWallet must be a valid Solana public key';
  }
  return null;
}

/**
 * Validate receipt request parameters
 */
export function validateReceiptRequest(data: any): string | null {
  if (!data.receiptId || typeof data.receiptId !== 'string') {
    return 'receiptId is required and must be a string';
  }
  if (!data.bountyId || typeof data.bountyId !== 'string') {
    return 'bountyId is required and must be a string';
  }
  if (!Number.isInteger(data.milestoneIndex) || data.milestoneIndex < 0) {
    return 'milestoneIndex is required and must be a non-negative integer';
  }
  if (data.artifactHash && !isValidHash(data.artifactHash)) {
    return 'artifactHash must be a valid SHA-256 hash (hex or base64)';
  }
  if (data.workerWallet && !isValidSolanaKey(data.workerWallet)) {
    return 'workerWallet must be a valid Solana public key';
  }
  return null;
}

/**
 * Validate dependency request parameters
 */
export function validateDependencyRequest(data: any): string | null {
  if (!data.edgeId || typeof data.edgeId !== 'string') {
    return 'edgeId is required and must be a string';
  }
  if (!data.sourceReceiptId || typeof data.sourceReceiptId !== 'string') {
    return 'sourceReceiptId is required and must be a string';
  }
  if (!data.targetReceiptId || typeof data.targetReceiptId !== 'string') {
    return 'targetReceiptId is required and must be a string';
  }
  if (data.sourceReceiptId === data.targetReceiptId) {
    return 'sourceReceiptId and targetReceiptId cannot be the same';
  }
  return null;
}

/**
 * Validate verification request parameters
 */
export function validateVerificationRequest(data: any): string | null {
  if (typeof data.approved !== 'boolean') {
    return 'approved is required and must be a boolean';
  }
  if (data.verifierNote && typeof data.verifierNote !== 'string') {
    return 'verifierNote must be a string if provided';
  }
  return null;
}

// ============ Response Handlers ============

/**
 * Send a success response
 */
export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Send a validation error response
 */
export function sendValidationError(res: Response, message: string): void {
  res.status(400).json({
    success: false,
    error: {
      code: ErrorCode.VALIDATION_ERROR,
      message,
    },
  });
}

/**
 * Send an error response
 */
export function sendError(res: Response, error: ApiError | Error): void {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    });
  } else {
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message || 'Internal server error',
      },
    });
  }
}

// ============ Webhook Utilities ============

export interface HeliusWebhookEvent {
  type: string;
  description: string;
  signature: string;
  slot: number;
  timestamp: number;
  source: string;
  events: Array<{
    type: string;
    description: string;
  }>;
}

/**
 * Parse Helius webhook event for BountyGraph
 */
export function parseHeliusEvent(event: any): { type: string; bountyId?: string } | null {
  try {
    if (event.type === 'TRANSACTION' && event.description) {
      // Parse transaction description for BountyGraph events
      const desc = event.description.toLowerCase();

      if (desc.includes('receipt') && desc.includes('submitted')) {
        return { type: 'RECEIPT_SUBMITTED' };
      }
      if (desc.includes('receipt') && desc.includes('verified')) {
        return { type: 'RECEIPT_VERIFIED' };
      }
      if (desc.includes('bounty') && desc.includes('created')) {
        return { type: 'BOUNTY_CREATED' };
      }
      if (desc.includes('dependency') && desc.includes('created')) {
        return { type: 'DEPENDENCY_CREATED' };
      }
    }
  } catch (error) {
    console.error('Error parsing Helius event:', error);
  }

  return null;
}

// ============ Utility Functions ============

/**
 * Calculate milestone payout amount
 */
export function calculateMilestonePayout(
  totalAmount: number,
  milestoneCount: number,
  currentMilestone: number = 0
): number {
  if (milestoneCount <= 0 || totalAmount <= 0) {
    return 0;
  }
  // Simple equal distribution (can be enhanced with weighted distribution)
  return Math.floor(totalAmount / milestoneCount);
}

/**
 * Generate a unique receipt ID
 */
export function generateReceiptId(bountyId: string, milestoneIndex: number): string {
  const timestamp = Date.now();
  return `receipt-${bountyId}-${milestoneIndex}-${timestamp}`;
}

/**
 * Generate a unique bounty ID
 */
export function generateBountyId(creatorWallet: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `bounty-${creatorWallet.substring(0, 8)}-${timestamp}-${random}`;
}

/**
 * Get current unix timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format error for logging
 */
export function formatErrorLog(error: any, context: string): string {
  if (error instanceof ApiError) {
    return `[${context}] ${error.code}: ${error.message}`;
  }
  return `[${context}] ${error?.message || String(error)}`;
}
