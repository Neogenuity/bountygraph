import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PublicKey, Connection } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Solana connection
const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// ============ Types ============

interface BountyRequest {
  bountyId: string;
  title: string;
  description: string;
  totalAmount: number;
  milestoneCount: number;
  creatorWallet: string;
}

interface ReceiptRequest {
  receiptId: string;
  bountyId: string;
  milestoneIndex: number;
  artifactHash: string;
  metadataUri: string;
  workerWallet: string;
}

interface BountyResponse {
  id: string;
  title: string;
  description: string;
  creator: string;
  totalAmount: number;
  releasedAmount: number;
  milestoneCount: number;
  completedMilestones: number;
  status: string;
  createdAt: number;
}

interface ReceiptResponse {
  id: string;
  bountyId: string;
  worker: string;
  milestoneIndex: number;
  artifactHash: string;
  status: string;
  submittedAt: number;
}

// ============ Routes ============

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Create a new bounty
 * POST /bounties
 */
app.post('/bounties', async (req, res) => {
  try {
    const {
      bountyId,
      title,
      description,
      totalAmount,
      milestoneCount,
      creatorWallet,
    }: BountyRequest = req.body;

    // Validation
    if (!bountyId || !title || !totalAmount || !milestoneCount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (milestoneCount < 1 || milestoneCount > 10) {
      return res
        .status(400)
        .json({ error: 'Milestone count must be between 1 and 10' });
    }

    // Mock bounty creation response
    const bounty: BountyResponse = {
      id: bountyId,
      title,
      description,
      creator: creatorWallet,
      totalAmount,
      releasedAmount: 0,
      milestoneCount,
      completedMilestones: 0,
      status: 'open',
      createdAt: Math.floor(Date.now() / 1000),
    };

    res.status(201).json({
      success: true,
      bounty,
      message: 'Bounty created. Transaction signature will be returned on-chain.',
    });
  } catch (error) {
    console.error('Error creating bounty:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get bounty by ID
 * GET /bounties/:bountyId
 */
app.get('/bounties/:bountyId', async (req, res) => {
  try {
    const { bountyId } = req.params;

    // Mock response
    const bounty: BountyResponse = {
      id: bountyId,
      title: `Bounty: ${bountyId}`,
      description: 'Description TBD',
      creator: 'Wallet address TBD',
      totalAmount: 1000,
      releasedAmount: 0,
      milestoneCount: 3,
      completedMilestones: 0,
      status: 'open',
      createdAt: Math.floor(Date.now() / 1000),
    };

    res.json(bounty);
  } catch (error) {
    console.error('Error fetching bounty:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Submit a receipt for a milestone
 * POST /receipts
 */
app.post('/receipts', async (req, res) => {
  try {
    const {
      receiptId,
      bountyId,
      milestoneIndex,
      artifactHash,
      metadataUri,
      workerWallet,
    }: ReceiptRequest = req.body;

    // Validation
    if (!receiptId || !bountyId || milestoneIndex === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mock receipt creation response
    const receipt: ReceiptResponse = {
      id: receiptId,
      bountyId,
      worker: workerWallet,
      milestoneIndex,
      artifactHash,
      status: 'pending',
      submittedAt: Math.floor(Date.now() / 1000),
    };

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

/**
 * Get receipt by ID
 * GET /receipts/:receiptId
 */
app.get('/receipts/:receiptId', async (req, res) => {
  try {
    const { receiptId } = req.params;

    // Mock response
    const receipt: ReceiptResponse = {
      id: receiptId,
      bountyId: 'bounty-1',
      worker: 'Wallet address TBD',
      milestoneIndex: 0,
      artifactHash: '0x' + 'a'.repeat(64),
      status: 'pending',
      submittedAt: Math.floor(Date.now() / 1000),
    };

    res.json(receipt);
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all receipts for a bounty
 * GET /bounties/:bountyId/receipts
 */
app.get('/bounties/:bountyId/receipts', async (req, res) => {
  try {
    const { bountyId } = req.params;

    // Mock response
    const receipts: ReceiptResponse[] = [
      {
        id: 'receipt-1',
        bountyId,
        worker: 'Wallet TBD',
        milestoneIndex: 0,
        artifactHash: '0x' + 'a'.repeat(64),
        status: 'pending',
        submittedAt: Math.floor(Date.now() / 1000),
      },
    ];

    res.json(receipts);
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Verify a receipt and release payout
 * POST /receipts/:receiptId/verify
 */
app.post('/receipts/:receiptId/verify', async (req, res) => {
  try {
    const { receiptId } = req.params;
    const { approved, verifierNote } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Invalid approval status' });
    }

    res.json({
      success: true,
      receiptId,
      approved,
      message: approved
        ? 'Receipt approved. Payout initiated.'
        : 'Receipt rejected.',
      verifierNote,
    });
  } catch (error) {
    console.error('Error verifying receipt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a dependency edge between receipts
 * POST /dependencies
 */
app.post('/dependencies', async (req, res) => {
  try {
    const { edgeId, sourceReceiptId, targetReceiptId } = req.body;

    if (!edgeId || !sourceReceiptId || !targetReceiptId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    res.status(201).json({
      success: true,
      edge: {
        id: edgeId,
        source: sourceReceiptId,
        target: targetReceiptId,
        createdAt: Math.floor(Date.now() / 1000),
      },
      message: 'Dependency edge created.',
    });
  } catch (error) {
    console.error('Error creating dependency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get dependency graph for a bounty
 * GET /bounties/:bountyId/graph
 */
app.get('/bounties/:bountyId/graph', async (req, res) => {
  try {
    const { bountyId } = req.params;

    // Mock DAG response
    const graph = {
      bountyId,
      nodes: [
        { id: 'receipt-1', status: 'pending', milestoneIndex: 0 },
        { id: 'receipt-2', status: 'approved', milestoneIndex: 1 },
      ],
      edges: [{ source: 'receipt-1', target: 'receipt-2' }],
      timestamp: Math.floor(Date.now() / 1000),
    };

    res.json(graph);
  } catch (error) {
    console.error('Error fetching graph:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get worker profile and reputation
 * GET /workers/:walletAddress
 */
app.get('/workers/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Mock worker profile
    const profile = {
      wallet: walletAddress,
      completedReceipts: 0,
      rejectedReceipts: 0,
      totalEarnings: 0,
      reputationScore: 0,
      createdAt: Math.floor(Date.now() / 1000),
    };

    res.json(profile);
  } catch (error) {
    console.error('Error fetching worker profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`BountyGraph API listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
