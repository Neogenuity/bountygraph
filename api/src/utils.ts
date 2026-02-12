/**
 * BountyGraph API Utilities
 * Validation, error handling, and helper functions
 */

import { Response } from 'express';
import { PublicKey } from '@solana/web3.js';

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
  if (typeof key !== 'string' || key.length === 0) return false;

  try {
    // PublicKey constructor validates base58 and byte length (32 bytes).
    // Do NOT require "on-curve"; PDAs are valid public keys and are off-curve.
    // Normalizing round-trip also rejects some malformed encodings.
    const pk = new PublicKey(key);
    return pk.toBase58() === key;
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
  _currentMilestone: number = 0
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
  const random = Math.random().toString(36).slice(2, 10);
  return `receipt-${bountyId}-${milestoneIndex}-${timestamp}-${random}`;
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

// ============ DAG Validation Functions ============

/**
 * Check if adding a dependency would create a cycle in the task graph.
 *
 * WHY DFS here:
 * - We want a cheap, incremental safety check at "edge insertion" time (task -> newDependency).
 * - DFS with a recursion stack finds back-edges (cycles) without requiring a full re-sort of the graph.
 * - Using `visited` + `recursionStack` keeps the check linear in the reachable subgraph, which matters
 *   when clients are constructing many tasks programmatically.
 */
export function wouldCreateCycle(
  taskId: string,
  newDependencyId: string,
  existingDependencies: Map<string, string[]>
): boolean {
  // If the new dependency is the task itself, that's a cycle
  if (taskId === newDependencyId) {
    return true;
  }

  // WHY this direction: a new edge (taskId -> newDependencyId) creates a cycle iff there is already
  // a path (newDependencyId -> ... -> taskId). We check reachability by walking dependency edges.
  // Build temporary graph with the new edge
  const tempDeps = new Map(existingDependencies);
  const currentDeps = tempDeps.get(taskId) || [];
  tempDeps.set(taskId, [...currentDeps, newDependencyId]);

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(currentId: string): boolean {
    if (recursionStack.has(currentId)) {
      return true; // Found a cycle
    }
    if (visited.has(currentId)) {
      return false; // Already checked this path
    }

    visited.add(currentId);
    recursionStack.add(currentId);

    const deps = tempDeps.get(currentId) || [];
    for (const depId of deps) {
      if (hasCycle(depId)) {
        return true;
      }
    }

    recursionStack.delete(currentId);
    return false;
  }

  // Check if the new graph has a cycle starting from taskId
  return hasCycle(taskId);
}

/**
 * Validate that a dependency list has no duplicates and is sorted
 */
export function validateDependencyList(dependencies: string[]): string | null {
  if (!Array.isArray(dependencies)) {
    return 'dependencies must be an array';
  }

  const seen = new Set<string>();
  let prev: string | null = null;

  for (const dep of dependencies) {
    if (typeof dep !== 'string') {
      return 'all dependency IDs must be strings';
    }
    if (seen.has(dep)) {
      return `duplicate dependency: ${dep}`;
    }
    if (prev && dep <= prev) {
      return 'dependencies must be sorted in ascending order';
    }
    seen.add(dep);
    prev = dep;
  }

  return null;
}

/**
 * Topological sort of tasks based on dependencies.
 * Returns sorted task IDs or null if there's a cycle.
 *
 * WHY Kahn's algorithm:
 * - Produces a deterministic execution order (given deterministic iteration) that respects prerequisites.
 * - Naturally detects cycles: if we can't consume all nodes (in-degree never reaches 0), a cycle exists.
 * - Avoids recursion and keeps memory overhead small for typical hackathon-scale graphs.
 */
export function topologicalSort(
  taskIds: string[],
  dependencies: Map<string, string[]>
): string[] | null {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  // Initialize
  for (const taskId of taskIds) {
    inDegree.set(taskId, 0);
    adjList.set(taskId, []);
  }

  const taskIdSet = new Set(taskIds);

  // Build graph
  for (const [taskId, deps] of dependencies.entries()) {
    for (const depId of deps) {
      // WHY: dependency maps may contain references outside the current subgraph (e.g., pagination).
      // Using a Set keeps membership checks O(1) and avoids an O(n^2) `includes` hotspot.
      if (!taskIdSet.has(depId)) continue;
      const children = adjList.get(depId) || [];
      children.push(taskId);
      adjList.set(depId, children);
      inDegree.set(taskId, (inDegree.get(taskId) || 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  // Find all nodes with in-degree 0
  for (const [taskId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(taskId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    const children = adjList.get(current) || [];
    for (const child of children) {
      const newDegree = (inDegree.get(child) || 0) - 1;
      inDegree.set(child, newDegree);
      if (newDegree === 0) {
        queue.push(child);
      }
    }
  }

  // If result doesn't contain all tasks, there's a cycle
  return result.length === taskIds.length ? result : null;
}

// ============ Reputation & Scoring Functions ============

export interface BountyCompletionData {
  bountyValue: number;
  completedOnTime: boolean;
  verificationTier: 'schema' | 'oracle' | 'optimistic';
  complexityScore: number; // 1-5
}

/**
 * Calculate reputation delta for a completed bounty
 */
export function calculateReputationDelta(data: BountyCompletionData): number {
  let delta = 10; // Base points

  // Complexity bonus (1-5 points)
  delta += Math.min(Math.max(data.complexityScore, 1), 5);

  // On-time bonus (3 points)
  if (data.completedOnTime) {
    delta += 3;
  }

  // Verification tier bonus
  switch (data.verificationTier) {
    case 'schema':
      delta += 2;
      break;
    case 'oracle':
      delta += 5;
      break;
    case 'optimistic':
      delta += 3;
      break;
  }

  // Value-based scaling (up to 5 bonus points for high-value bounties)
  if (data.bountyValue >= 1000000000) { // 1 SOL in lamports
    delta += 5;
  } else if (data.bountyValue >= 100000000) { // 0.1 SOL
    delta += 3;
  } else if (data.bountyValue >= 10000000) { // 0.01 SOL
    delta += 1;
  }

  return delta;
}

/**
 * Calculate worker reputation level from total points
 */
export function getReputationLevel(points: number): {
  level: number;
  name: string;
  nextLevelPoints: number;
} {
  const levels = [
    { level: 1, name: 'Novice', threshold: 0 },
    { level: 2, name: 'Apprentice', threshold: 50 },
    { level: 3, name: 'Journeyman', threshold: 150 },
    { level: 4, name: 'Expert', threshold: 400 },
    { level: 5, name: 'Master', threshold: 1000 },
    { level: 6, name: 'Grandmaster', threshold: 2500 },
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (points >= levels[i].threshold) {
      const nextLevel = levels[i + 1];
      return {
        level: levels[i].level,
        name: levels[i].name,
        nextLevelPoints: nextLevel ? nextLevel.threshold : Infinity,
      };
    }
  }

  return { ...levels[0], nextLevelPoints: levels.length > 1 ? levels[1].threshold : Infinity };
}

/**
 * Format bounty status for display
 */
export function formatBountyStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'open': 'Open for Workers',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'disputed': 'Under Dispute',
    'resolved': 'Dispute Resolved',
    'cancelled': 'Cancelled',
  };
  return statusMap[status.toLowerCase()] || status;
}
