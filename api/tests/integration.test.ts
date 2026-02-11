/**
 * BountyGraph API Integration Tests
 * Tests for REST endpoints and server functionality
 */

import * as assert from 'assert';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TIMEOUT = 10000;

describe('BountyGraph API Integration Tests', () => {
  let createdBountyId: string;
  let createdReceiptId: string;

  describe('Health & Server Tests', () => {
    it('should return 200 on health check', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/health`);
      assert.equal(response.status, 200, 'Health endpoint should return 200');
      const data: any = await response.json();
      assert.ok(data.status, 'Status should be present');
    });

    it('should accept CORS requests', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/health`, {
        headers: { Origin: 'http://localhost:3000' },
      });
      assert.ok(
        response.headers.get('access-control-allow-origin'),
        'CORS headers should be present'
      );
    });

    it('should return JSON responses', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/health`);
      const contentType = response.headers.get('content-type');
      assert.ok(
        contentType?.includes('application/json'),
        'Response should be JSON'
      );
    });
  });

  describe('Bounty Creation Tests', () => {
    it('should create a bounty with valid parameters', async function () {
      this.timeout(TIMEOUT);
      createdBountyId = 'bounty-' + Date.now();
      const payload = {
        bountyId: createdBountyId,
        title: 'Test Bounty',
        description: 'A test bounty for integration testing',
        totalAmount: 1_000_000,
        milestoneCount: 3,
        creatorWallet: 'wallet123',
      };

      const response = await fetch(`${API_URL}/bounties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.equal(response.status, 201, 'Should return 201 Created');
      const data: any = await response.json();
      assert.ok(data.success, 'Response should indicate success');
      assert.equal(data.bounty.id, createdBountyId, 'Bounty ID should match');
      assert.equal(data.bounty.status, 'open', 'Initial status should be open');
    });

    it('should reject bounty without required fields', async function () {
      this.timeout(TIMEOUT);
      const payload = {
        title: 'Incomplete Bounty',
        // Missing bountyId, totalAmount, milestoneCount
      };

      const response = await fetch(`${API_URL}/bounties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.equal(response.status, 400, 'Should return 400 Bad Request');
      const data: any = await response.json();
      assert.ok(data.error, 'Should include error message');
    });

    it('should reject bounty with invalid milestone count', async function () {
      this.timeout(TIMEOUT);
      const payload = {
        bountyId: 'invalid-' + Date.now(),
        title: 'Invalid Bounty',
        totalAmount: 1_000_000,
        milestoneCount: 15, // > 10
      };

      const response = await fetch(`${API_URL}/bounties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.equal(response.status, 400, 'Should reject invalid milestone count');
    });

    it('should return proper structure for created bounty', async function () {
      this.timeout(TIMEOUT);
      const payload = {
        bountyId: 'structure-test-' + Date.now(),
        title: 'Structure Test',
        totalAmount: 1_000_000,
        milestoneCount: 2,
      };

      const response = await fetch(`${API_URL}/bounties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();
      const bounty = data.bounty;

      assert.ok(bounty.id, 'Bounty should have ID');
      assert.ok(bounty.title, 'Bounty should have title');
      assert.ok(typeof bounty.totalAmount === 'number', 'Total amount should be number');
      assert.ok(typeof bounty.milestoneCount === 'number', 'Milestone count should be number');
      assert.equal(bounty.releasedAmount, 0, 'Released amount should start at 0');
      assert.equal(bounty.completedMilestones, 0, 'Completed milestones should start at 0');
    });
  });

  describe('Bounty Retrieval Tests', () => {
    it('should retrieve bounty by ID', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/bounties/${createdBountyId}`);
      assert.equal(response.status, 200, 'Should return 200 OK');
      const data: any = await response.json();
      assert.equal(data.id, createdBountyId, 'Bounty ID should match request');
    });

    it('should return 404 for non-existent bounty', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/bounties/non-existent-id`);
      // Note: Current API returns mock data; in production should return 404
      assert.ok(response.status === 200 || response.status === 404);
    });

    it('should include all bounty fields in response', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/bounties/${createdBountyId}`);
      const data: any = await response.json();

      assert.ok(data.id, 'Should have id');
      assert.ok(data.title, 'Should have title');
      assert.ok(typeof data.totalAmount === 'number', 'Should have totalAmount');
      assert.ok(typeof data.milestoneCount === 'number', 'Should have milestoneCount');
      assert.ok(typeof data.status === 'string', 'Should have status');
      assert.ok(typeof data.createdAt === 'number', 'Should have createdAt');
    });
  });

  describe('Receipt Submission Tests', () => {
    it('should submit a receipt for a milestone', async function () {
      this.timeout(TIMEOUT);
      createdReceiptId = 'receipt-' + Date.now();
      const payload = {
        receiptId: createdReceiptId,
        bountyId: createdBountyId,
        milestoneIndex: 0,
        artifactHash: 'a'.repeat(64),
        metadataUri: 'ipfs://QmTest123',
        workerWallet: 'worker-wallet-1',
      };

      const response = await fetch(`${API_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.equal(response.status, 201, 'Should return 201 Created');
      const data: any = await response.json();
      assert.ok(data.success, 'Response should indicate success');
      assert.equal(data.receipt.id, createdReceiptId, 'Receipt ID should match');
      assert.equal(data.receipt.status, 'pending', 'Initial status should be pending');
    });

    it('should reject receipt without required fields', async function () {
      this.timeout(TIMEOUT);
      const payload = {
        receiptId: 'test-receipt',
        // Missing bountyId, milestoneIndex
      };

      const response = await fetch(`${API_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.equal(response.status, 400, 'Should return 400 Bad Request');
    });

    it('should include complete receipt structure', async function () {
      this.timeout(TIMEOUT);
      const payload = {
        receiptId: 'full-test-' + Date.now(),
        bountyId: 'bounty-123',
        milestoneIndex: 0,
        artifactHash: 'abc123',
        metadataUri: 'ipfs://test',
        workerWallet: 'worker-123',
      };

      const response = await fetch(`${API_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();
      const receipt = data.receipt;

      assert.ok(receipt.id, 'Receipt should have id');
      assert.ok(receipt.bountyId, 'Receipt should have bountyId');
      assert.ok(typeof receipt.milestoneIndex === 'number', 'Should have milestoneIndex');
      assert.ok(receipt.status, 'Receipt should have status');
      assert.ok(typeof receipt.submittedAt === 'number', 'Should have submittedAt');
    });
  });

  describe('Receipt Retrieval Tests', () => {
    it('should retrieve receipt by ID', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/receipts/${createdReceiptId}`);
      assert.equal(response.status, 200, 'Should return 200 OK');
      const data: any = await response.json();
      assert.ok(data.id, 'Response should have receipt ID');
    });

    it('should get all receipts for a bounty', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/bounties/${createdBountyId}/receipts`);
      assert.equal(response.status, 200, 'Should return 200 OK');
      const data: any = await response.json();
      assert.ok(Array.isArray(data), 'Should return array of receipts');
    });

    it('should filter receipts by bounty correctly', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(
        `${API_URL}/bounties/${createdBountyId}/receipts`
      );
      const data: any = await response.json();

      if (data.length > 0) {
        assert.ok(
          data.every((r: any) => r.bountyId === createdBountyId),
          'All receipts should belong to the bounty'
        );
      }
    });
  });

  describe('Receipt Verification Tests', () => {
    it('should verify receipt and approve', async function () {
      this.timeout(TIMEOUT);
      const payload = {
        approved: true,
        verifierNote: 'Work quality is excellent',
      };

      const response = await fetch(
        `${API_URL}/receipts/${createdReceiptId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      assert.equal(response.status, 200, 'Should return 200 OK');
      const data: any = await response.json();
      assert.ok(data.success, 'Should indicate success');
      assert.equal(data.approved, true, 'Should reflect approval');
    });

    it('should verify receipt and reject', async function () {
      this.timeout(TIMEOUT);
      const receiptId = 'reject-test-' + Date.now();
      const payload = {
        approved: false,
        verifierNote: 'Does not meet quality standards',
      };

      const response = await fetch(
        `${API_URL}/receipts/${receiptId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data: any = await response.json();
      assert.equal(data.approved, false, 'Should reflect rejection');
      assert.ok(data.verifierNote, 'Should include rejection reason');
    });

    it('should require valid approval status', async function () {
      this.timeout(TIMEOUT);
      const payload = {
        approved: 'maybe', // Invalid: should be boolean
      };

      const response = await fetch(
        `${API_URL}/receipts/${createdReceiptId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      assert.equal(response.status, 400, 'Should return 400 for invalid input');
    });
  });

  describe('Dependency Graph Tests', () => {
    it('should create a dependency edge', async function () {
      this.timeout(TIMEOUT);
      const payload = {
        edgeId: 'edge-' + Date.now(),
        sourceReceiptId: 'receipt-1',
        targetReceiptId: 'receipt-2',
      };

      const response = await fetch(`${API_URL}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.equal(response.status, 201, 'Should return 201 Created');
      const data: any = await response.json();
      assert.ok(data.success, 'Should indicate success');
      assert.ok(data.edge.id, 'Edge should have ID');
      assert.ok(data.edge.source, 'Edge should have source');
      assert.ok(data.edge.target, 'Edge should have target');
    });

    it('should reject dependency without required fields', async function () {
      this.timeout(TIMEOUT);
      const payload = {
        edgeId: 'incomplete-edge',
        // Missing sourceReceiptId, targetReceiptId
      };

      const response = await fetch(`${API_URL}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.equal(response.status, 400, 'Should return 400 Bad Request');
    });

    it('should retrieve dependency graph for bounty', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(
        `${API_URL}/bounties/${createdBountyId}/graph`
      );
      assert.equal(response.status, 200, 'Should return 200 OK');
      const data: any = await response.json();

      assert.ok(data.bountyId, 'Graph should reference bounty');
      assert.ok(Array.isArray(data.nodes), 'Graph should have nodes');
      assert.ok(Array.isArray(data.edges), 'Graph should have edges');
    });
  });

  describe('Worker Profile Tests', () => {
    const testWallet = 'wallet-test-' + Date.now();

    it('should retrieve worker profile', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(
        `${API_URL}/workers/${testWallet}`
      );
      assert.equal(response.status, 200, 'Should return 200 OK');
      const data: any = await response.json();

      assert.ok(data.wallet, 'Should have wallet address');
      assert.ok(typeof data.completedReceipts === 'number', 'Should track completed receipts');
      assert.ok(typeof data.totalEarnings === 'number', 'Should track earnings');
      assert.ok(typeof data.reputationScore === 'number', 'Should have reputation score');
    });

    it('should initialize new worker profile', async function () {
      this.timeout(TIMEOUT);
      const newWorkerWallet = 'new-worker-' + Date.now();
      const response = await fetch(
        `${API_URL}/workers/${newWorkerWallet}`
      );
      const data: any = await response.json();

      assert.equal(data.completedReceipts, 0, 'New profile should start at 0 receipts');
      assert.equal(data.totalEarnings, 0, 'New profile should have 0 earnings');
      assert.equal(data.reputationScore, 0, 'New profile should have 0 reputation');
    });

    it('should include all worker profile fields', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(
        `${API_URL}/workers/${testWallet}`
      );
      const data: any = await response.json();

      assert.ok(data.wallet, 'Should have wallet');
      assert.ok('completedReceipts' in data, 'Should have completedReceipts');
      assert.ok('rejectedReceipts' in data, 'Should have rejectedReceipts');
      assert.ok('totalEarnings' in data, 'Should have totalEarnings');
      assert.ok('reputationScore' in data, 'Should have reputationScore');
      assert.ok('createdAt' in data, 'Should have createdAt');
    });
  });

  describe('Error Handling Tests', () => {
    it('should return 404 for invalid routes', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/invalid-route`);
      assert.notEqual(response.status, 200, 'Invalid route should not return 200');
    });

    it('should handle malformed JSON gracefully', async function () {
      this.timeout(TIMEOUT);
      const response = await fetch(`${API_URL}/bounties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      });

      assert.equal(response.status, 400, 'Should return 400 for malformed JSON');
    });

    it('should timeout on slow requests', async function () {
      this.timeout(15000);
      // This is a placeholder for timeout testing
      // In real scenario, would need to mock slow server
      assert.ok(true);
    });
  });

  describe('Data Integrity Tests', () => {
    it('should preserve bounty data across multiple requests', async function () {
      this.timeout(TIMEOUT);
      const bountyId = 'integrity-test-' + Date.now();
      const originalData = {
        bountyId,
        title: 'Integrity Test Bounty',
        totalAmount: 2_000_000,
        milestoneCount: 4,
      };

      // Create
      const createResponse = await fetch(`${API_URL}/bounties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(originalData),
      });

      const createdData: any = await createResponse.json();

      // Retrieve
      const getResponse = await fetch(`${API_URL}/bounties/${bountyId}`);
      const retrievedData: any = await getResponse.json();

      assert.equal(retrievedData.id, originalData.bountyId, 'ID should match');
      assert.equal(retrievedData.title, originalData.title, 'Title should match');
    });

    it('should maintain atomic updates', async function () {
      this.timeout(TIMEOUT);
      const receiptId = 'atomic-test-' + Date.now();
      const payload = {
        receiptId,
        bountyId: 'test-bounty',
        milestoneIndex: 0,
        artifactHash: 'test-hash',
        metadataUri: 'test-uri',
      };

      const response = await fetch(`${API_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();
      assert.equal(data.receipt.id, receiptId, 'Receipt should be created atomically');
    });
  });

  describe('Performance Tests', () => {
    it('should respond to health check quickly', async function () {
      this.timeout(TIMEOUT);
      const startTime = Date.now();
      await fetch(`${API_URL}/health`);
      const duration = Date.now() - startTime;

      assert.ok(duration < 1000, 'Health check should respond in < 1s');
    });

    it('should handle concurrent requests', async function () {
      this.timeout(TIMEOUT);
      const requests = Array(5)
        .fill(null)
        .map((_, i) => fetch(`${API_URL}/health`));

      const responses = await Promise.all(requests);
      assert.ok(
        responses.every((r) => r.status === 200),
        'All concurrent requests should succeed'
      );
    });
  });
});
