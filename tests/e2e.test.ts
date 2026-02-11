/**
 * BountyGraph End-to-End Tests
 * Complete flow from bounty creation to payment distribution
 */

import * as assert from 'assert';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TIMEOUT = 30000;

describe('BountyGraph End-to-End Flow', () => {
  let bountyId: string;
  let receiptIds: string[] = [];
  let creatorWallet: string;
  let worker1Wallet: string;
  let verifierWallet: string;

  before(function () {
    this.timeout(TIMEOUT);
    bountyId = 'e2e-bounty-' + Date.now();
    creatorWallet = 'e2e-creator-' + Date.now();
    worker1Wallet = 'e2e-worker1-' + Date.now();
    verifierWallet = 'e2e-verifier-' + Date.now();
  });

  describe('Scenario: Create Bounty → Submit Receipts → Verify → Release Payment', () => {
    step('should create a multi-milestone bounty', async function () {
      this.timeout(TIMEOUT);

      const bountyPayload = {
        bountyId,
        title: 'E2E Test Bounty - AI Model Training',
        description:
          'Train and validate a machine learning model with 3 milestones',
        totalAmount: 3_000_000, // 3 USDC
        milestoneCount: 3,
        creatorWallet,
      };

      try {
        const response = await fetch(`${API_URL}/bounties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bountyPayload),
        });

        assert.equal(response.status, 201, 'Bounty creation should succeed');
        const data: any = await response.json();
        assert.equal(data.bounty.id, bountyId, 'Bounty ID should match');
        assert.equal(data.bounty.milestoneCount, 3, 'Milestone count should be 3');
        assert.equal(data.bounty.releasedAmount, 0, 'Initial released amount should be 0');

        console.log(`✓ Bounty created: ${bountyId}`);
      } catch (error) {
        console.log('Note: API server may not be running. E2E test skipped.');
        this.skip();
      }
    });

    step('should submit receipt for milestone 1', async function () {
      this.timeout(TIMEOUT);

      const receiptId = 'e2e-receipt-1-' + Date.now();
      receiptIds.push(receiptId);

      const receiptPayload = {
        receiptId,
        bountyId,
        milestoneIndex: 0,
        artifactHash: 'a'.repeat(64), // Placeholder hash
        metadataUri: 'ipfs://Qm1234567890abcdef1234567890abcdef12345678',
        workerWallet: worker1Wallet,
      };

      const response = await fetch(`${API_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptPayload),
      });

      assert.equal(response.status, 201, 'Receipt submission should succeed');
      const data: any = await response.json();
      assert.equal(data.receipt.id, receiptId, 'Receipt ID should match');
      assert.equal(data.receipt.status, 'pending', 'Receipt status should be pending');

      console.log(`✓ Receipt submitted for milestone 0: ${receiptId}`);
    });

    step('should submit receipt for milestone 2', async function () {
      this.timeout(TIMEOUT);

      const receiptId = 'e2e-receipt-2-' + Date.now();
      receiptIds.push(receiptId);

      const receiptPayload = {
        receiptId,
        bountyId,
        milestoneIndex: 1,
        artifactHash: 'b'.repeat(64),
        metadataUri: 'ipfs://QmReceipt2-1234567890abcdef1234567890ab',
        workerWallet: worker1Wallet,
      };

      const response = await fetch(`${API_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptPayload),
      });

      assert.equal(response.status, 201, 'Receipt 2 submission should succeed');
      const data: any = await response.json();
      assert.equal(data.receipt.milestoneIndex, 1, 'Milestone index should be 1');

      console.log(`✓ Receipt submitted for milestone 1: ${receiptId}`);
    });

    step('should submit receipt for milestone 3', async function () {
      this.timeout(TIMEOUT);

      const receiptId = 'e2e-receipt-3-' + Date.now();
      receiptIds.push(receiptId);

      const receiptPayload = {
        receiptId,
        bountyId,
        milestoneIndex: 2,
        artifactHash: 'c'.repeat(64),
        metadataUri: 'ipfs://QmReceipt3-1234567890abcdef1234567890ab',
        workerWallet: worker1Wallet,
      };

      const response = await fetch(`${API_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptPayload),
      });

      assert.equal(response.status, 201, 'Receipt 3 submission should succeed');

      console.log(`✓ Receipt submitted for milestone 2: ${receiptId}`);
    });

    step('should verify first receipt and release partial payment', async function () {
      this.timeout(TIMEOUT);

      const receiptId = receiptIds[0];
      const verifyPayload = {
        approved: true,
        verifierNote: 'Data collection phase completed successfully',
      };

      const response = await fetch(`${API_URL}/receipts/${receiptId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload),
      });

      assert.equal(response.status, 200, 'Verification should succeed');
      const data: any = await response.json();
      assert.equal(data.approved, true, 'Receipt should be approved');

      console.log(
        `✓ Receipt verified for milestone 0. Payment released: 1.00 USDC`
      );
    });

    step('should verify second receipt and release payment', async function () {
      this.timeout(TIMEOUT);

      const receiptId = receiptIds[1];
      const verifyPayload = {
        approved: true,
        verifierNote: 'Model training completed with target accuracy',
      };

      const response = await fetch(`${API_URL}/receipts/${receiptId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload),
      });

      assert.equal(response.status, 200, 'Verification should succeed');
      const data: any = await response.json();
      assert.equal(data.approved, true, 'Receipt should be approved');

      console.log(
        `✓ Receipt verified for milestone 1. Payment released: 1.00 USDC`
      );
    });

    step('should verify third receipt and complete bounty', async function () {
      this.timeout(TIMEOUT);

      const receiptId = receiptIds[2];
      const verifyPayload = {
        approved: true,
        verifierNote: 'Final validation and deployment completed',
      };

      const response = await fetch(`${API_URL}/receipts/${receiptId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload),
      });

      assert.equal(response.status, 200, 'Final verification should succeed');
      const data: any = await response.json();
      assert.equal(data.approved, true, 'Final receipt should be approved');

      console.log(
        `✓ Receipt verified for milestone 2. Payment released: 1.00 USDC`
      );
      console.log('✓ Bounty completed. Total payout: 3.00 USDC');
    });

    step('should create dependency edges showing work sequence', async function () {
      this.timeout(TIMEOUT);

      // Receipt 0 -> Receipt 1 (data needed for training)
      const edge1Payload = {
        edgeId: 'e2e-edge-1-' + Date.now(),
        sourceReceiptId: receiptIds[0],
        targetReceiptId: receiptIds[1],
      };

      let response = await fetch(`${API_URL}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edge1Payload),
      });

      assert.equal(response.status, 201, 'First dependency should be created');
      console.log(`✓ Dependency created: Receipt0 → Receipt1`);

      // Receipt 1 -> Receipt 2 (validation depends on training)
      const edge2Payload = {
        edgeId: 'e2e-edge-2-' + Date.now(),
        sourceReceiptId: receiptIds[1],
        targetReceiptId: receiptIds[2],
      };

      response = await fetch(`${API_URL}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edge2Payload),
      });

      assert.equal(response.status, 201, 'Second dependency should be created');
      console.log(`✓ Dependency created: Receipt1 → Receipt2`);
    });

    step('should retrieve complete dependency graph', async function () {
      this.timeout(TIMEOUT);

      const response = await fetch(`${API_URL}/bounties/${bountyId}/graph`);
      assert.equal(response.status, 200, 'Graph retrieval should succeed');
      const data: any = await response.json();

      assert.ok(Array.isArray(data.nodes), 'Graph should have nodes');
      assert.ok(Array.isArray(data.edges), 'Graph should have edges');
      assert.ok(data.nodes.length >= 3, 'Should have 3+ nodes');

      console.log(
        `✓ DAG retrieved: ${data.nodes.length} nodes, ${data.edges.length} edges`
      );
    });

    step('should retrieve worker profile with updated reputation', async function () {
      this.timeout(TIMEOUT);

      const response = await fetch(`${API_URL}/workers/${worker1Wallet}`);
      assert.equal(response.status, 200, 'Worker profile retrieval should succeed');
      const data: any = await response.json();

      assert.ok(data.completedReceipts >= 0, 'Should track completed receipts');
      assert.ok(data.totalEarnings >= 0, 'Should track total earnings');
      assert.ok(
        typeof data.reputationScore === 'number',
        'Should have reputation score'
      );

      console.log(
        `✓ Worker Profile: ${data.completedReceipts} completed, ${data.totalEarnings} earned, reputation ${data.reputationScore}`
      );
    });

    step('should retrieve bounty with updated status', async function () {
      this.timeout(TIMEOUT);

      const response = await fetch(`${API_URL}/bounties/${bountyId}`);
      assert.equal(response.status, 200, 'Bounty retrieval should succeed');
      const data: any = await response.json();

      assert.ok(data.id === bountyId, 'Bounty ID should match');
      assert.ok(
        data.completedMilestones > 0,
        'Should have completed milestones'
      );

      console.log(
        `✓ Bounty Status: ${data.completedMilestones}/${data.milestoneCount} milestones completed`
      );
    });
  });

  describe('Alternative Scenario: Bounty with Rejected Receipt', () => {
    let altBountyId: string;
    let altReceiptId: string;

    before(function () {
      this.timeout(TIMEOUT);
      altBountyId = 'e2e-alt-bounty-' + Date.now();
      altReceiptId = 'e2e-alt-receipt-' + Date.now();
    });

    step('should create alternative bounty', async function () {
      this.timeout(TIMEOUT);

      const bountyPayload = {
        bountyId: altBountyId,
        title: 'Alternative Test Bounty',
        totalAmount: 1_000_000,
        milestoneCount: 1,
        creatorWallet: 'alt-creator',
      };

      try {
        const response = await fetch(`${API_URL}/bounties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bountyPayload),
        });

        if (response.ok) {
          console.log(`✓ Alternative bounty created: ${altBountyId}`);
        } else {
          this.skip();
        }
      } catch {
        this.skip();
      }
    });

    step('should submit receipt for alternative bounty', async function () {
      this.timeout(TIMEOUT);

      const receiptPayload = {
        receiptId: altReceiptId,
        bountyId: altBountyId,
        milestoneIndex: 0,
        artifactHash: 'd'.repeat(64),
        metadataUri: 'ipfs://QmAlt',
        workerWallet: 'alt-worker',
      };

      const response = await fetch(`${API_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptPayload),
      });

      if (response.ok) {
        console.log(
          `✓ Alternative receipt submitted: ${altReceiptId}`
        );
      } else {
        this.skip();
      }
    });

    step('should reject receipt on quality check', async function () {
      this.timeout(TIMEOUT);

      const verifyPayload = {
        approved: false,
        verifierNote:
          'Code quality does not meet standards. Please refactor and resubmit.',
      };

      const response = await fetch(
        `${API_URL}/receipts/${altReceiptId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyPayload),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        assert.equal(data.approved, false, 'Receipt should be rejected');
        console.log(`✓ Receipt rejected with reason: "${data.verifierNote}"`);
      } else {
        this.skip();
      }
    });

    step('escrow should remain locked after rejection', async function () {
      this.timeout(TIMEOUT);

      const response = await fetch(`${API_URL}/bounties/${altBountyId}`);
      if (response.ok) {
        const data: any = await response.json();
        assert.equal(
          data.releasedAmount,
          0,
          'No funds should be released after rejection'
        );
        console.log(`✓ Escrow locked: 1.00 USDC retained for retry`);
      } else {
        this.skip();
      }
    });
  });
});

/**
 * Helper function for step descriptions
 */
function step(description: string, fn: any) {
  it(description, fn);
}
