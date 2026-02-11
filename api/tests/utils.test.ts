/**
 * BountyGraph API Utilities Test Suite
 * Tests for validation, error handling, and helper functions
 */

import * as assert from 'assert';
import {
  isValidSolanaKey,
  isValidHash,
  validateBountyRequest,
  validateReceiptRequest,
  validateDependencyRequest,
  validateVerificationRequest,
  calculateMilestonePayout,
  generateReceiptId,
  generateBountyId,
  getCurrentTimestamp,
  ErrorCode,
  ApiError,
  wouldCreateCycle,
  validateDependencyList,
  topologicalSort,
  calculateReputationDelta,
  getReputationLevel,
  formatBountyStatus,
} from '../src/utils';

describe('BountyGraph API Utilities', () => {
  describe('Solana Key Validation', () => {
    it('should validate correct Solana public key', () => {
      const validKey = 'BGRPHFnG8z7gxJnefVh3Y7LV9TjTuN2hfQdqzN9vNS5A';
      assert.ok(isValidSolanaKey(validKey), 'Valid Solana key should pass validation');
    });

    it('should reject invalid Solana public key (too short)', () => {
      const invalidKey = 'BGRPHFnG8z7gxJn';
      assert.ok(!isValidSolanaKey(invalidKey), 'Short key should fail validation');
    });

    it('should reject invalid Solana public key (invalid characters)', () => {
      const invalidKey = '0'.repeat(44);
      assert.ok(!isValidSolanaKey(invalidKey), 'Invalid characters should fail validation');
    });

    it('should reject empty key', () => {
      assert.ok(!isValidSolanaKey(''), 'Empty key should fail validation');
      assert.ok(!isValidSolanaKey(null as any), 'Null key should fail validation');
    });
  });

  describe('Hash Validation', () => {
    it('should validate SHA-256 hex hash', () => {
      const hexHash = 'a'.repeat(64);
      assert.ok(isValidHash(hexHash), 'Valid hex hash should pass validation');
    });

    it('should validate SHA-256 base64 hash', () => {
      const base64Hash = 'a'.repeat(43) + '=';
      assert.ok(isValidHash(base64Hash), 'Valid base64 hash should pass validation');
    });

    it('should reject invalid hash (wrong length)', () => {
      const invalidHash = 'a'.repeat(50);
      assert.ok(!isValidHash(invalidHash), 'Hash with wrong length should fail');
    });

    it('should reject invalid hash (wrong characters)', () => {
      const invalidHash = 'z'.repeat(64);
      assert.ok(!isValidHash(invalidHash), 'Hash with invalid chars should fail');
    });

    it('should reject empty hash', () => {
      assert.ok(!isValidHash(''), 'Empty hash should fail validation');
    });
  });

  describe('Bounty Request Validation', () => {
    it('should validate correct bounty request', () => {
      const validRequest = {
        bountyId: 'bounty-123',
        title: 'Test Bounty',
        totalAmount: 1000,
        milestoneCount: 3,
        creatorWallet: 'BGRPHFnG8z7gxJnefVh3Y7LV9TjTuN2hfQdqzN9vNS5A',
      };
      const error = validateBountyRequest(validRequest);
      assert.strictEqual(error, null, 'Valid request should have no error');
    });

    it('should reject missing bountyId', () => {
      const invalidRequest = {
        title: 'Test Bounty',
        totalAmount: 1000,
        milestoneCount: 3,
      };
      const error = validateBountyRequest(invalidRequest);
      assert.ok(error?.includes('bountyId'), 'Should error on missing bountyId');
    });

    it('should reject invalid totalAmount', () => {
      const invalidRequest = {
        bountyId: 'bounty-123',
        title: 'Test Bounty',
        totalAmount: -100,
        milestoneCount: 3,
      };
      const error = validateBountyRequest(invalidRequest);
      assert.ok(error?.includes('totalAmount'), 'Should error on invalid totalAmount');
    });

    it('should reject invalid milestoneCount', () => {
      const invalidRequest = {
        bountyId: 'bounty-123',
        title: 'Test Bounty',
        totalAmount: 1000,
        milestoneCount: 15,
      };
      const error = validateBountyRequest(invalidRequest);
      assert.ok(error?.includes('milestoneCount'), 'Should error on milestoneCount > 10');
    });

    it('should reject invalid Solana wallet', () => {
      const invalidRequest = {
        bountyId: 'bounty-123',
        title: 'Test Bounty',
        totalAmount: 1000,
        milestoneCount: 3,
        creatorWallet: 'invalid-wallet',
      };
      const error = validateBountyRequest(invalidRequest);
      assert.ok(error?.includes('creatorWallet'), 'Should error on invalid wallet');
    });
  });

  describe('Receipt Request Validation', () => {
    it('should validate correct receipt request', () => {
      const validRequest = {
        receiptId: 'receipt-123',
        bountyId: 'bounty-123',
        milestoneIndex: 0,
        artifactHash: 'a'.repeat(64),
        metadataUri: 'ipfs://QmExample',
        workerWallet: 'BGRPHFnG8z7gxJnefVh3Y7LV9TjTuN2hfQdqzN9vNS5A',
      };
      const error = validateReceiptRequest(validRequest);
      assert.strictEqual(error, null, 'Valid request should have no error');
    });

    it('should reject missing bountyId', () => {
      const invalidRequest = {
        receiptId: 'receipt-123',
        milestoneIndex: 0,
      };
      const error = validateReceiptRequest(invalidRequest);
      assert.ok(error?.includes('bountyId'), 'Should error on missing bountyId');
    });

    it('should reject invalid milestoneIndex', () => {
      const invalidRequest = {
        receiptId: 'receipt-123',
        bountyId: 'bounty-123',
        milestoneIndex: -1,
      };
      const error = validateReceiptRequest(invalidRequest);
      assert.ok(error?.includes('milestoneIndex'), 'Should error on negative milestoneIndex');
    });

    it('should reject invalid artifactHash', () => {
      const invalidRequest = {
        receiptId: 'receipt-123',
        bountyId: 'bounty-123',
        milestoneIndex: 0,
        artifactHash: 'invalid-hash',
      };
      const error = validateReceiptRequest(invalidRequest);
      assert.ok(error?.includes('artifactHash'), 'Should error on invalid hash');
    });
  });

  describe('Dependency Request Validation', () => {
    it('should validate correct dependency request', () => {
      const validRequest = {
        edgeId: 'edge-123',
        sourceReceiptId: 'receipt-1',
        targetReceiptId: 'receipt-2',
      };
      const error = validateDependencyRequest(validRequest);
      assert.strictEqual(error, null, 'Valid request should have no error');
    });

    it('should reject identical source and target', () => {
      const invalidRequest = {
        edgeId: 'edge-123',
        sourceReceiptId: 'receipt-1',
        targetReceiptId: 'receipt-1',
      };
      const error = validateDependencyRequest(invalidRequest);
      assert.ok(error?.includes('cannot be the same'), 'Should error on identical receipts');
    });

    it('should reject missing edgeId', () => {
      const invalidRequest = {
        sourceReceiptId: 'receipt-1',
        targetReceiptId: 'receipt-2',
      };
      const error = validateDependencyRequest(invalidRequest);
      assert.ok(error?.includes('edgeId'), 'Should error on missing edgeId');
    });
  });

  describe('Verification Request Validation', () => {
    it('should validate correct verification request (approved)', () => {
      const validRequest = {
        approved: true,
        verifierNote: 'Looks good',
      };
      const error = validateVerificationRequest(validRequest);
      assert.strictEqual(error, null, 'Valid request should have no error');
    });

    it('should validate correct verification request (rejected)', () => {
      const validRequest = {
        approved: false,
        verifierNote: 'Needs revision',
      };
      const error = validateVerificationRequest(validRequest);
      assert.strictEqual(error, null, 'Valid request should have no error');
    });

    it('should reject missing approved field', () => {
      const invalidRequest = {
        verifierNote: 'Some note',
      };
      const error = validateVerificationRequest(invalidRequest);
      assert.ok(error?.includes('approved'), 'Should error on missing approved field');
    });

    it('should reject invalid approved type', () => {
      const invalidRequest = {
        approved: 'yes',
      };
      const error = validateVerificationRequest(invalidRequest);
      assert.ok(error?.includes('approved'), 'Should error on non-boolean approved');
    });
  });

  describe('Payout Calculation', () => {
    it('should calculate equal milestone payouts', () => {
      const payout = calculateMilestonePayout(1000, 5);
      assert.strictEqual(payout, 200, 'Should divide amount equally');
    });

    it('should handle large numbers', () => {
      const payout = calculateMilestonePayout(10000000, 10);
      assert.strictEqual(payout, 1000000, 'Should handle large amounts');
    });

    it('should return 0 for invalid inputs', () => {
      assert.strictEqual(calculateMilestonePayout(0, 5), 0, 'Should return 0 for zero amount');
      assert.strictEqual(calculateMilestonePayout(1000, 0), 0, 'Should return 0 for zero milestones');
      assert.strictEqual(calculateMilestonePayout(-1000, 5), 0, 'Should return 0 for negative amount');
    });
  });

  describe('ID Generation', () => {
    it('should generate unique receipt IDs', () => {
      const id1 = generateReceiptId('bounty-1', 0);
      const id2 = generateReceiptId('bounty-1', 0);
      assert.notStrictEqual(id1, id2, 'Should generate unique IDs');
    });

    it('should generate unique bounty IDs', () => {
      const id1 = generateBountyId('wallet-1');
      const id2 = generateBountyId('wallet-1');
      assert.notStrictEqual(id1, id2, 'Should generate unique IDs');
    });

    it('should include bounty context in receipt ID', () => {
      const id = generateReceiptId('bounty-1', 2);
      assert.ok(id.includes('bounty-1'), 'Receipt ID should include bounty ID');
      assert.ok(id.includes('2'), 'Receipt ID should include milestone index');
    });
  });

  describe('Timestamp Utility', () => {
    it('should return current unix timestamp', () => {
      const ts = getCurrentTimestamp();
      const expectedTs = Math.floor(Date.now() / 1000);
      assert.ok(Math.abs(ts - expectedTs) <= 1, 'Should return current timestamp');
    });

    it('should return an integer', () => {
      const ts = getCurrentTimestamp();
      assert.ok(Number.isInteger(ts), 'Timestamp should be an integer');
    });
  });

  describe('Error Handling', () => {
    it('should create ApiError correctly', () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Test error',
        { field: 'test' }
      );
      assert.strictEqual(error.code, ErrorCode.VALIDATION_ERROR);
      assert.strictEqual(error.statusCode, 400);
      assert.strictEqual(error.message, 'Test error');
      assert.deepStrictEqual(error.details, { field: 'test' });
    });

    it('should handle different error codes', () => {
      const errorCodes = [
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.NOT_FOUND,
        ErrorCode.UNAUTHORIZED,
        ErrorCode.INVALID_SOLANA_KEY,
        ErrorCode.INSUFFICIENT_BALANCE,
      ];

      errorCodes.forEach((code) => {
        const error = new ApiError(code, 400, 'Test');
        assert.strictEqual(error.code, code);
      });
    });
  });

  describe('DAG Cycle Detection', () => {
    it('should detect direct self-reference cycle', () => {
      const deps = new Map<string, string[]>();
      const hasCycle = wouldCreateCycle('task-1', 'task-1', deps);
      assert.ok(hasCycle, 'Should detect self-reference cycle');
    });

    it('should detect simple cycle (A -> B -> A)', () => {
      const deps = new Map<string, string[]>([
        ['task-B', ['task-A']],
      ]);
      const hasCycle = wouldCreateCycle('task-A', 'task-B', deps);
      assert.ok(hasCycle, 'Should detect simple 2-node cycle');
    });

    it('should detect complex cycle (A -> B -> C -> A)', () => {
      const deps = new Map<string, string[]>([
        ['task-B', ['task-A']],
        ['task-C', ['task-B']],
      ]);
      const hasCycle = wouldCreateCycle('task-A', 'task-C', deps);
      assert.ok(hasCycle, 'Should detect 3-node cycle');
    });

    it('should allow valid DAG (A -> B, C -> B)', () => {
      const deps = new Map<string, string[]>([
        ['task-A', ['task-B']],
      ]);
      const hasCycle = wouldCreateCycle('task-C', 'task-B', deps);
      assert.ok(!hasCycle, 'Should allow valid DAG structure');
    });

    it('should allow linear chain (A -> B -> C -> D)', () => {
      const deps = new Map<string, string[]>([
        ['task-A', ['task-B']],
        ['task-B', ['task-C']],
      ]);
      const hasCycle = wouldCreateCycle('task-C', 'task-D', deps);
      assert.ok(!hasCycle, 'Should allow linear chain');
    });

    it('should handle empty dependency map', () => {
      const deps = new Map<string, string[]>();
      const hasCycle = wouldCreateCycle('task-A', 'task-B', deps);
      assert.ok(!hasCycle, 'Should handle empty dependencies');
    });
  });

  describe('Dependency List Validation', () => {
    it('should validate correct sorted dependency list', () => {
      const deps = ['task-1', 'task-2', 'task-3'];
      const error = validateDependencyList(deps);
      assert.strictEqual(error, null, 'Should accept sorted list');
    });

    it('should reject unsorted dependency list', () => {
      const deps = ['task-2', 'task-1', 'task-3'];
      const error = validateDependencyList(deps);
      assert.ok(error?.includes('sorted'), 'Should reject unsorted list');
    });

    it('should reject duplicate dependencies', () => {
      const deps = ['task-1', 'task-1', 'task-2'];
      const error = validateDependencyList(deps);
      assert.ok(error?.includes('duplicate'), 'Should reject duplicates');
    });

    it('should reject non-string dependencies', () => {
      const deps = ['task-1', 123 as any, 'task-3'];
      const error = validateDependencyList(deps);
      assert.ok(error?.includes('strings'), 'Should reject non-strings');
    });

    it('should reject non-array input', () => {
      const error = validateDependencyList('not-an-array' as any);
      assert.ok(error?.includes('array'), 'Should reject non-array');
    });

    it('should accept empty array', () => {
      const error = validateDependencyList([]);
      assert.strictEqual(error, null, 'Should accept empty array');
    });
  });

  describe('Topological Sort', () => {
    it('should sort simple linear dependency chain', () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      const deps = new Map<string, string[]>([
        ['task-1', ['task-2']],
        ['task-2', ['task-3']],
      ]);
      const sorted = topologicalSort(taskIds, deps);
      assert.deepStrictEqual(sorted, ['task-3', 'task-2', 'task-1']);
    });

    it('should sort diamond dependency graph', () => {
      const taskIds = ['A', 'B', 'C', 'D'];
      const deps = new Map<string, string[]>([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
      ]);
      const sorted = topologicalSort(taskIds, deps);
      assert.ok(sorted !== null, 'Should return valid sort');
      assert.strictEqual(sorted![0], 'D', 'D should be first (no dependencies)');
      assert.strictEqual(sorted![3], 'A', 'A should be last (depends on all)');
    });

    it('should detect cycle and return null', () => {
      const taskIds = ['A', 'B', 'C'];
      const deps = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']],
      ]);
      const sorted = topologicalSort(taskIds, deps);
      assert.strictEqual(sorted, null, 'Should return null for cyclic graph');
    });

    it('should handle tasks with no dependencies', () => {
      const taskIds = ['A', 'B', 'C'];
      const deps = new Map<string, string[]>();
      const sorted = topologicalSort(taskIds, deps);
      assert.strictEqual(sorted?.length, 3, 'Should return all tasks');
    });

    it('should handle single task', () => {
      const taskIds = ['A'];
      const deps = new Map<string, string[]>();
      const sorted = topologicalSort(taskIds, deps);
      assert.deepStrictEqual(sorted, ['A']);
    });
  });

  describe('Reputation Calculation', () => {
    it('should calculate base reputation points', () => {
      const data = {
        bountyValue: 1000000,
        completedOnTime: false,
        verificationTier: 'schema' as const,
        complexityScore: 1,
      };
      const delta = calculateReputationDelta(data);
      assert.ok(delta >= 10, 'Should have at least base points');
    });

    it('should add on-time bonus', () => {
      const onTimeData = {
        bountyValue: 1000000,
        completedOnTime: true,
        verificationTier: 'schema' as const,
        complexityScore: 1,
      };
      const lateData = { ...onTimeData, completedOnTime: false };

      const onTimeDelta = calculateReputationDelta(onTimeData);
      const lateDelta = calculateReputationDelta(lateData);

      assert.strictEqual(onTimeDelta - lateDelta, 3, 'On-time bonus should be 3 points');
    });

    it('should vary by verification tier', () => {
      const baseData = {
        bountyValue: 1000000,
        completedOnTime: false,
        complexityScore: 1,
      };

      const schemaDelta = calculateReputationDelta({
        ...baseData,
        verificationTier: 'schema' as const,
      });
      const oracleDelta = calculateReputationDelta({
        ...baseData,
        verificationTier: 'oracle' as const,
      });
      const optimisticDelta = calculateReputationDelta({
        ...baseData,
        verificationTier: 'optimistic' as const,
      });

      assert.ok(oracleDelta > schemaDelta, 'Oracle should give more points than schema');
      assert.ok(optimisticDelta > schemaDelta, 'Optimistic should give more points than schema');
      assert.ok(oracleDelta > optimisticDelta, 'Oracle should give most points');
    });

    it('should scale with bounty value', () => {
      const lowValueData = {
        bountyValue: 1000000, // 0.001 SOL
        completedOnTime: false,
        verificationTier: 'schema' as const,
        complexityScore: 1,
      };
      const highValueData = {
        ...lowValueData,
        bountyValue: 1000000000, // 1 SOL
      };

      const lowDelta = calculateReputationDelta(lowValueData);
      const highDelta = calculateReputationDelta(highValueData);

      assert.ok(highDelta > lowDelta, 'High-value bounties should give more points');
    });

    it('should cap complexity bonus at 5', () => {
      const lowComplexity = {
        bountyValue: 1000000,
        completedOnTime: false,
        verificationTier: 'schema' as const,
        complexityScore: 1,
      };
      const highComplexity = { ...lowComplexity, complexityScore: 10 };

      const lowDelta = calculateReputationDelta(lowComplexity);
      const highDelta = calculateReputationDelta(highComplexity);

      assert.ok(highDelta - lowDelta <= 5, 'Complexity bonus should be capped at 5');
    });
  });

  describe('Reputation Level System', () => {
    it('should return Novice for low points', () => {
      const level = getReputationLevel(0);
      assert.strictEqual(level.level, 1);
      assert.strictEqual(level.name, 'Novice');
    });

    it('should return Apprentice for 50+ points', () => {
      const level = getReputationLevel(50);
      assert.strictEqual(level.level, 2);
      assert.strictEqual(level.name, 'Apprentice');
    });

    it('should return Master for 1000+ points', () => {
      const level = getReputationLevel(1000);
      assert.strictEqual(level.level, 5);
      assert.strictEqual(level.name, 'Master');
    });

    it('should return Grandmaster for 2500+ points', () => {
      const level = getReputationLevel(2500);
      assert.strictEqual(level.level, 6);
      assert.strictEqual(level.name, 'Grandmaster');
    });

    it('should provide next level threshold', () => {
      const level = getReputationLevel(100);
      assert.ok(level.nextLevelPoints > 100, 'Should provide next level points');
    });

    it('should handle max level gracefully', () => {
      const level = getReputationLevel(10000);
      assert.strictEqual(level.level, 6);
      assert.strictEqual(level.nextLevelPoints, Infinity);
    });
  });

  describe('Bounty Status Formatting', () => {
    it('should format common status values', () => {
      assert.strictEqual(formatBountyStatus('open'), 'Open for Workers');
      assert.strictEqual(formatBountyStatus('in_progress'), 'In Progress');
      assert.strictEqual(formatBountyStatus('completed'), 'Completed');
      assert.strictEqual(formatBountyStatus('disputed'), 'Under Dispute');
    });

    it('should handle case insensitivity', () => {
      assert.strictEqual(formatBountyStatus('OPEN'), 'Open for Workers');
      assert.strictEqual(formatBountyStatus('OpEn'), 'Open for Workers');
    });

    it('should return unknown status as-is', () => {
      const unknown = 'unknown_status';
      assert.strictEqual(formatBountyStatus(unknown), unknown);
    });
  });
});
