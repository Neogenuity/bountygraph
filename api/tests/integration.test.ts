/**
 * BountyGraph API Integration Tests
 * Runs against an in-process Express app (no external server required)
 */

import * as assert from 'assert';
import request from 'supertest';
import { createApp, createDefaultState } from '../src/app';

const TIMEOUT = 10000;

describe('BountyGraph API Integration Tests', () => {
  const state = createDefaultState();
  const app = createApp(state);

  let createdBountyId: string;
  let createdReceiptId: string;

  describe('Health & Server Tests', () => {
    it('should return 200 on health check', async function () {
      this.timeout(TIMEOUT);
      const response = await request(app).get('/health').expect(200);
      assert.ok(response.body.status, 'Status should be present');
    });

    it('should accept CORS requests', async function () {
      this.timeout(TIMEOUT);
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      assert.ok(response.headers['access-control-allow-origin'], 'CORS headers should be present');
    });

    it('should return JSON responses', async function () {
      this.timeout(TIMEOUT);
      const response = await request(app).get('/health').expect(200);
      const contentType = response.headers['content-type'];
      assert.ok(contentType?.includes('application/json'), 'Response should be JSON');
    });
  });

  describe('Bounty Creation & Retrieval Tests', () => {
    it('should create a bounty with valid parameters', async function () {
      this.timeout(TIMEOUT);
      createdBountyId = 'bounty-' + Date.now();

      const response = await request(app)
        .post('/bounties')
        .send({
          bountyId: createdBountyId,
          title: 'Test Bounty',
          description: 'A test bounty for integration testing',
          totalAmount: 1_000_000,
          milestoneCount: 3,
          creatorWallet: 'wallet123',
        })
        .expect(201);

      assert.ok(response.body.success, 'Response should indicate success');
      assert.equal(response.body.bounty.id, createdBountyId, 'Bounty ID should match');
      assert.equal(response.body.bounty.status, 'open', 'Initial status should be open');
    });

    it('should reject bounty without required fields', async function () {
      this.timeout(TIMEOUT);
      await request(app)
        .post('/bounties')
        .send({ title: 'Incomplete Bounty' })
        .expect(400);
    });

    it('should reject bounty with invalid milestone count', async function () {
      this.timeout(TIMEOUT);
      await request(app)
        .post('/bounties')
        .send({
          bountyId: 'invalid-' + Date.now(),
          title: 'Invalid Bounty',
          totalAmount: 1_000_000,
          milestoneCount: 15,
          creatorWallet: 'wallet123',
        })
        .expect(400);
    });

    it('should retrieve bounty by ID', async function () {
      this.timeout(TIMEOUT);
      const response = await request(app)
        .get(`/bounties/${createdBountyId}`)
        .expect(200);
      assert.equal(response.body.id, createdBountyId, 'Bounty ID should match request');
    });

    it('should return 404 for non-existent bounty', async function () {
      this.timeout(TIMEOUT);
      await request(app).get('/bounties/non-existent-id').expect(404);
    });
  });

  describe('Receipt Submission & Retrieval Tests', () => {
    it('should submit a receipt for a milestone', async function () {
      this.timeout(TIMEOUT);
      createdReceiptId = 'receipt-' + Date.now();

      const response = await request(app)
        .post('/receipts')
        .send({
          receiptId: createdReceiptId,
          bountyId: createdBountyId,
          milestoneIndex: 0,
          artifactHash: 'a'.repeat(64),
          metadataUri: 'ipfs://QmTest123',
          workerWallet: 'worker-wallet-1',
        })
        .expect(201);

      assert.ok(response.body.success, 'Response should indicate success');
      assert.equal(response.body.receipt.id, createdReceiptId, 'Receipt ID should match');
      assert.equal(response.body.receipt.status, 'pending', 'Initial status should be pending');
    });

    it('should reject receipt without required fields', async function () {
      this.timeout(TIMEOUT);
      await request(app)
        .post('/receipts')
        .send({ receiptId: 'test-receipt' })
        .expect(400);
    });

    it('should prevent duplicate receipt for same milestone from same worker', async function () {
      this.timeout(TIMEOUT);
      const bountyId = 'dup-test-' + Date.now();

      // Create a bounty
      await request(app)
        .post('/bounties')
        .send({
          bountyId,
          title: 'Duplicate Test',
          totalAmount: 1_000_000,
          milestoneCount: 2,
          creatorWallet: 'creator-dup',
        })
        .expect(201);

      // Submit first receipt
      const receipt1Id = 'receipt-dup-1-' + Date.now();
      await request(app)
        .post('/receipts')
        .send({
          receiptId: receipt1Id,
          bountyId,
          milestoneIndex: 0,
          artifactHash: 'a'.repeat(64),
          metadataUri: 'ipfs://first',
          workerWallet: 'worker-dup',
        })
        .expect(201);

      // Try to submit another receipt for the same milestone from same worker
      const receipt2Id = 'receipt-dup-2-' + Date.now();
      const response = await request(app)
        .post('/receipts')
        .send({
          receiptId: receipt2Id,
          bountyId,
          milestoneIndex: 0,
          artifactHash: 'b'.repeat(64),
          metadataUri: 'ipfs://second',
          workerWallet: 'worker-dup',
        })
        .expect(409);

      assert.ok(response.body.error.includes('already submitted'));
    });

    it('should retrieve receipt by ID', async function () {
      this.timeout(TIMEOUT);
      const response = await request(app)
        .get(`/receipts/${createdReceiptId}`)
        .expect(200);
      assert.equal(response.body.id, createdReceiptId);
    });

    it('should get all receipts for a bounty', async function () {
      this.timeout(TIMEOUT);
      const response = await request(app)
        .get(`/bounties/${createdBountyId}/receipts`)
        .expect(200);
      assert.ok(Array.isArray(response.body), 'Should return array of receipts');
      assert.ok(response.body.every((r: any) => r.bountyId === createdBountyId));
    });
  });

  describe('Receipt Verification Tests', () => {
    it('should verify receipt and approve with authorized verifier', async function () {
      this.timeout(TIMEOUT);
      const response = await request(app)
        .post(`/receipts/${createdReceiptId}/verify`)
        .send({ approved: true, verifier: 'wallet123', verifierNote: 'Work quality is excellent' })
        .expect(200);

      assert.ok(response.body.success);
      assert.equal(response.body.approved, true);
    });

    it('should reject verification from unauthorized verifier', async function () {
      this.timeout(TIMEOUT);
      // Create a new receipt to test with unauthorized verifier
      const receiptId = 'receipt-' + Date.now();
      await request(app)
        .post('/receipts')
        .send({
          receiptId,
          bountyId: createdBountyId,
          milestoneIndex: 1,
          artifactHash: 'b'.repeat(64),
          metadataUri: 'ipfs://test',
          workerWallet: 'worker-wallet-2',
        })
        .expect(201);

      // Try to verify with a different wallet than the creator
      const response = await request(app)
        .post(`/receipts/${receiptId}/verify`)
        .send({ approved: true, verifier: 'unauthorized-wallet' })
        .expect(403);

      assert.ok(response.body.error.includes('creator'));
    });

    it('should require valid approval status', async function () {
      this.timeout(TIMEOUT);
      await request(app)
        .post(`/receipts/${createdReceiptId}/verify`)
        .send({ approved: 'maybe' })
        .expect(400);
    });

    it('should require verifier field', async function () {
      this.timeout(TIMEOUT);
      await request(app)
        .post(`/receipts/${createdReceiptId}/verify`)
        .send({ approved: true })
        .expect(400);
    });
  });

  describe('Error Handling Tests', () => {
    it('should return 404 for invalid routes', async function () {
      this.timeout(TIMEOUT);
      await request(app).get('/invalid-route').expect(404);
    });

    it('should handle malformed JSON gracefully', async function () {
      this.timeout(TIMEOUT);
      await request(app)
        .post('/bounties')
        .set('Content-Type', 'application/json')
        .send('{invalid json}')
        .expect(400);
    });
  });
});
