import * as assert from 'assert';
import request from 'supertest';
import { createApp, createDefaultState } from '../src/app';

describe('BountyGraph API dispute flow', () => {
  it('allows creator to raise dispute and arbiter to resolve with a split', async () => {
    const state = createDefaultState();
    const app = createApp(state);

    const bountyId = `bounty-${Date.now()}`;
    const creator = 'creator-wallet';
    const worker = 'worker-wallet';

    const createRes = await request(app)
      .post('/bounties')
      .send({
        bountyId,
        title: 'Test',
        description: 'desc',
        totalAmount: 1000,
        milestoneCount: 2,
        creatorWallet: creator,
      })
      .expect(201);

    assert.equal(createRes.body.bounty.id, bountyId);

    await request(app)
      .post('/receipts')
      .send({
        receiptId: `r-${Date.now()}`,
        bountyId,
        milestoneIndex: 0,
        artifactHash: 'a'.repeat(64),
        metadataUri: 'ipfs://x',
        workerWallet: worker,
      })
      .expect(201);

    const raise = await request(app)
      .post(`/bounties/${bountyId}/disputes`)
      .send({ raisedBy: creator, reason: 'quality' })
      .expect(201);

    assert.equal(raise.body.bounty.disputeStatus, 'raised');
    assert.equal(raise.body.bounty.status, 'disputed');

    const resolve = await request(app)
      .post(`/bounties/${bountyId}/disputes/resolve`)
      .send({ resolvedBy: 'arbiter-wallet', workerAwardAmount: 200 })
      .expect(200);

    assert.equal(resolve.body.bounty.disputeStatus, 'resolved');
    assert.equal(resolve.body.bounty.workerAwardAmount, 200);
    assert.equal(resolve.body.distribution.creatorRefundAmount, 800);
  });

  it('prevents non-participants from raising disputes', async () => {
    const state = createDefaultState();
    const app = createApp(state);

    const bountyId = `bounty-${Date.now()}`;

    await request(app)
      .post('/bounties')
      .send({
        bountyId,
        title: 'Test',
        totalAmount: 1000,
        milestoneCount: 1,
        creatorWallet: 'creator-wallet',
      })
      .expect(201);

    await request(app)
      .post(`/bounties/${bountyId}/disputes`)
      .send({ raisedBy: 'random-wallet' })
      .expect(403);
  });

  it('enforces access control on receipt verification', async () => {
    const state = createDefaultState();
    const app = createApp(state);

    const bountyId = `bounty-verify-${Date.now()}`;
    const creator = 'creator-wallet';
    const worker = 'worker-wallet';

    // Create bounty
    await request(app)
      .post('/bounties')
      .send({
        bountyId,
        title: 'Verify Test',
        totalAmount: 1000,
        milestoneCount: 1,
        creatorWallet: creator,
      })
      .expect(201);

    // Submit receipt
    const receiptId = `r-${Date.now()}`;
    await request(app)
      .post('/receipts')
      .send({
        receiptId,
        bountyId,
        milestoneIndex: 0,
        artifactHash: 'a'.repeat(64),
        metadataUri: 'ipfs://x',
        workerWallet: worker,
      })
      .expect(201);

    // Try to verify with non-creator (should fail)
    await request(app)
      .post(`/receipts/${receiptId}/verify`)
      .send({ approved: true, verifier: 'attacker-wallet' })
      .expect(403);

    // Verify with creator (should succeed)
    await request(app)
      .post(`/receipts/${receiptId}/verify`)
      .send({ approved: true, verifier: creator })
      .expect(200);
  });
});
