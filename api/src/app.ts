import express from 'express';
import cors from 'cors';
import {
  validateBountyRequest,
  validateReceiptRequest,
  validateVerificationRequest,
  isValidSolanaKey,
} from './utils';

export type BountyStatus = 'open' | 'completed' | 'disputed' | 'resolved';
export type DisputeStatus = 'none' | 'raised' | 'resolved';

export interface BountyRecord {
  id: string;
  title: string;
  description?: string;
  creator: string;
  totalAmount: number;
  releasedAmount: number;
  milestoneCount: number;
  completedMilestones: number;
  status: BountyStatus;
  createdAt: number;
  disputeStatus: DisputeStatus;
  disputedBy?: string;
  disputeReason?: string;
  disputeRaisedAt?: number;
  resolvedBy?: string;
  disputeResolvedAt?: number;
  workerAwardAmount?: number;
}

export interface ReceiptRecord {
  id: string;
  bountyId: string;
  worker: string;
  milestoneIndex: number;
  artifactHash: string;
  metadataUri?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: number;
}

export interface AppState {
  bounties: Map<string, BountyRecord>;
  receipts: Map<string, ReceiptRecord>;
}

export const createDefaultState = (): AppState => ({
  bounties: new Map(),
  receipts: new Map(),
});

export function createApp(state: AppState = createDefaultState()) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/bounties', async (req, res) => {
    try {
      const {
        bountyId,
        title,
        description,
        totalAmount,
        milestoneCount,
        creatorWallet,
      } = req.body ?? {};

      // Use shared validator
      const validationError = validateBountyRequest(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      if (!bountyId || !title || !totalAmount || !milestoneCount || !creatorWallet) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (typeof totalAmount !== 'number' || totalAmount <= 0) {
        return res.status(400).json({ error: 'Total amount must be > 0' });
      }

      if (typeof milestoneCount !== 'number' || milestoneCount < 1 || milestoneCount > 10) {
        return res
          .status(400)
          .json({ error: 'Milestone count must be between 1 and 10' });
      }

      if (state.bounties.has(bountyId)) {
        return res.status(409).json({ error: 'Bounty already exists' });
      }

      const now = Math.floor(Date.now() / 1000);
      const bounty: BountyRecord = {
        id: bountyId,
        title,
        description,
        creator: creatorWallet,
        totalAmount,
        releasedAmount: 0,
        milestoneCount,
        completedMilestones: 0,
        status: 'open',
        createdAt: now,
        disputeStatus: 'none',
      };

      state.bounties.set(bountyId, bounty);

      res.status(201).json({
        success: true,
        bounty,
        message: 'Bounty created.',
      });
    } catch (error) {
      console.error('Error creating bounty:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/bounties/:bountyId', async (req, res) => {
    try {
      const { bountyId } = req.params;
      const bounty = state.bounties.get(bountyId);
      if (!bounty) return res.status(404).json({ error: 'Bounty not found' });
      res.json(bounty);
    } catch (error) {
      console.error('Error fetching bounty:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/receipts', async (req, res) => {
    try {
      const {
        receiptId,
        bountyId,
        milestoneIndex,
        artifactHash,
        metadataUri,
        workerWallet,
      } = req.body ?? {};

      // Use shared validator
      const validationError = validateReceiptRequest(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      if (!receiptId || !bountyId || milestoneIndex === undefined || !workerWallet) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Enforce artifact hash requirement (no empty hashes allowed)
      if (!artifactHash || typeof artifactHash !== 'string' || artifactHash.trim() === '') {
        return res.status(400).json({ error: 'artifactHash is required and cannot be empty' });
      }

      const bounty = state.bounties.get(bountyId);
      if (!bounty) return res.status(404).json({ error: 'Bounty not found' });

      if (bounty.status !== 'open') {
        return res.status(409).json({ error: `Bounty is not open (status=${bounty.status})` });
      }

      if (typeof milestoneIndex !== 'number' || milestoneIndex < 0 || milestoneIndex >= bounty.milestoneCount) {
        return res.status(400).json({ error: 'Invalid milestone index' });
      }

      if (state.receipts.has(receiptId)) {
        return res.status(409).json({ error: 'Receipt already exists' });
      }

      // Check for duplicate receipts: prevent multiple receipts for the same milestone by the same worker
      const existingReceiptForMilestone = Array.from(state.receipts.values()).find(
        (r) => r.bountyId === bountyId && r.milestoneIndex === milestoneIndex && r.worker === workerWallet && r.status === 'pending'
      );
      if (existingReceiptForMilestone) {
        return res.status(409).json({
          error: 'Receipt already submitted for this milestone by this worker',
          existingReceiptId: existingReceiptForMilestone.id,
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const receipt: ReceiptRecord = {
        id: receiptId,
        bountyId,
        worker: workerWallet,
        milestoneIndex,
        artifactHash: artifactHash,
        metadataUri,
        status: 'pending',
        submittedAt: now,
      };

      state.receipts.set(receiptId, receipt);

      res.status(201).json({
        success: true,
        receipt,
        message: 'Receipt submitted for verification.',
      });
    } catch (error) {
      console.error('Error submitting receipt:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/receipts/:receiptId', async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = state.receipts.get(receiptId);
      if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
      res.json(receipt);
    } catch (error) {
      console.error('Error fetching receipt:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/bounties/:bountyId/receipts', async (req, res) => {
    try {
      const { bountyId } = req.params;
      if (!state.bounties.has(bountyId)) return res.status(404).json({ error: 'Bounty not found' });

      const receipts = Array.from(state.receipts.values()).filter((r) => r.bountyId === bountyId);
      res.json(receipts);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/receipts/:receiptId/verify', async (req, res) => {
    try {
      const { receiptId } = req.params;
      const { approved, verifierNote, verifier } = req.body ?? {};

      // Use shared validator
      const validationError = validateVerificationRequest(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      if (!verifier || typeof verifier !== 'string') {
        return res.status(400).json({ error: 'Verifier wallet is required' });
      }

      // Validate Solana key format
      if (!isValidSolanaKey(verifier)) {
        return res.status(400).json({ error: 'verifier must be a valid Solana public key' });
      }

      const receipt = state.receipts.get(receiptId);
      if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

      const bounty = state.bounties.get(receipt.bountyId);
      if (!bounty) return res.status(404).json({ error: 'Bounty not found' });

      // Access control: only the bounty creator can verify receipts
      if (verifier !== bounty.creator) {
        return res.status(403).json({
          error: 'Only the bounty creator can verify receipts',
        });
      }

      if (bounty.disputeStatus !== 'none') {
        return res.status(409).json({ error: 'Bounty is in dispute' });
      }

      if (receipt.status !== 'pending') {
        return res.status(409).json({ error: 'Receipt already verified' });
      }

      receipt.status = approved ? 'approved' : 'rejected';

      if (approved) {
        const perMilestone = Math.floor(bounty.totalAmount / bounty.milestoneCount);
        bounty.releasedAmount += perMilestone;
        bounty.completedMilestones += 1;
        if (bounty.completedMilestones >= bounty.milestoneCount) {
          bounty.status = 'completed';
        }
      }

      res.json({
        success: true,
        receiptId,
        approved,
        message: approved ? 'Receipt approved. Payout initiated.' : 'Receipt rejected.',
        verifierNote,
      });
    } catch (error) {
      console.error('Error verifying receipt:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/bounties/:bountyId/disputes', async (req, res) => {
    try {
      const { bountyId } = req.params;
      const { raisedBy, reason } = req.body ?? {};

      if (!raisedBy || typeof raisedBy !== 'string') {
        return res.status(400).json({ error: 'raisedBy is required' });
      }

      const bounty = state.bounties.get(bountyId);
      if (!bounty) return res.status(404).json({ error: 'Bounty not found' });

      if (bounty.disputeStatus !== 'none') {
        return res.status(409).json({ error: 'Dispute already raised' });
      }

      const isCreator = raisedBy === bounty.creator;
      const isWorker = Array.from(state.receipts.values()).some(
        (r) => r.bountyId === bountyId && r.worker === raisedBy
      );

      if (!isCreator && !isWorker) {
        return res.status(403).json({ error: 'Only creator or participating worker can dispute' });
      }

      bounty.disputeStatus = 'raised';
      bounty.status = 'disputed';
      bounty.disputedBy = raisedBy;
      bounty.disputeReason = typeof reason === 'string' ? reason : undefined;
      bounty.disputeRaisedAt = Math.floor(Date.now() / 1000);

      res.status(201).json({
        success: true,
        bounty,
        message: 'Dispute raised',
      });
    } catch (error) {
      console.error('Error raising dispute:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/bounties/:bountyId/disputes/resolve', async (req, res) => {
    try {
      const { bountyId } = req.params;
      const { resolvedBy, workerAwardAmount, requesterWallet } = req.body ?? {};

      if (!resolvedBy || typeof resolvedBy !== 'string') {
        return res.status(400).json({ error: 'resolvedBy is required' });
      }

      if (!requesterWallet || typeof requesterWallet !== 'string') {
        return res.status(400).json({ error: 'requesterWallet is required for authorization' });
      }

      if (typeof workerAwardAmount !== 'number' || workerAwardAmount < 0) {
        return res.status(400).json({ error: 'workerAwardAmount must be a non-negative number' });
      }

      const bounty = state.bounties.get(bountyId);
      if (!bounty) return res.status(404).json({ error: 'Bounty not found' });

      // Authorization: only bounty creator can resolve disputes
      if (bounty.creator !== requesterWallet) {
        return res.status(403).json({ error: 'Only bounty creator can resolve disputes' });
      }

      if (bounty.disputeStatus !== 'raised') {
        return res.status(409).json({ error: 'No dispute raised' });
      }

      const remaining = Math.max(0, bounty.totalAmount - bounty.releasedAmount);
      if (workerAwardAmount > remaining) {
        return res.status(400).json({ error: 'workerAwardAmount exceeds remaining escrow' });
      }

      bounty.disputeStatus = 'resolved';
      bounty.status = 'resolved';
      bounty.resolvedBy = resolvedBy;
      bounty.disputeResolvedAt = Math.floor(Date.now() / 1000);
      bounty.workerAwardAmount = workerAwardAmount;

      res.json({
        success: true,
        bounty,
        distribution: {
          workerAwardAmount,
          creatorRefundAmount: remaining - workerAwardAmount,
        },
      });
    } catch (error) {
      console.error('Error resolving dispute:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON' });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
