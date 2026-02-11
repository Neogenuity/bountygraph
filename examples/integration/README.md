# BountyGraph Integration Guide

This guide shows you how to integrate BountyGraph into your application, protocol, or platform to enable trustless bounty management on Solana.

## Overview

BountyGraph provides a decentralized bounty escrow system built on Solana. External projects can integrate via:

- **Direct Program Calls**: Invoke BountyGraph instructions from your own Anchor program
- **TypeScript SDK**: Use the JavaScript SDK for client-side interactions
- **REST API**: Interact with the backend API for off-chain operations
- **PDA Derivation**: Query escrow state and verify funds directly on-chain

## Prerequisites

Before integrating, ensure you have:

- **Anchor**: `anchor --version` (v0.29+)
- **Solana CLI**: `solana --version` (1.18+)
- **Node.js**: v18+ with npm or yarn
- **Wallet Setup**: Phantom, Ledger, or Solflare for transaction signing
- **Network Access**: Devnet or mainnet RPC endpoint

## Installation

```bash
# Install the BountyGraph SDK
npm install @bountygraph/sdk @solana/web3.js @project-serum/anchor

# Or with Anchor workspace
anchor add-dep bountygraph --git https://github.com/neogenuity/bountygraph --branch main
```

## Quick Start Code Examples

### 1. Initialize Connection and Provider

```typescript
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Provider, AnchorProvider, Program } from '@project-serum/anchor';

// Setup connection to devnet
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Setup wallet (Phantom in browser)
const wallet = window.solana;
await wallet.connect();

// Create provider
const provider = new AnchorProvider(connection, wallet, {
  commitment: 'confirmed',
});

// Initialize BountyGraph program
import { IDL } from '@bountygraph/sdk';
const programId = new PublicKey('YOUR_BOUNTYGRAPH_PROGRAM_ID');
const program = new Program(IDL, programId, provider);
```

### 2. Create a Bounty

```typescript
import { PublicKey, Keypair } from '@solana/web3.js';

// Derive bounty PDA
const bountyId = new PublicKey('YOUR_UNIQUE_BOUNTY_ID');
const [bountyPda, bumpSeed] = await PublicKey.findProgramAddress(
  [Buffer.from('bounty'), bountyId.toBuffer()],
  programId
);

// Create bounty transaction
const tx = await program.methods
  .createBounty({
    bountyId: bountyId,
    title: 'Fix critical bug in auth module',
    description: 'Security issue in login flow',
    rewardAmount: new BN(1_000_000_000), // 1 SOL in lamports
    deadline: new BN(Math.floor(Date.now() / 1000) + 86400 * 7), // 7 days
  })
  .accounts({
    bounty: bountyPda,
    creator: provider.wallet.publicKey,
    escrow: escrowTokenAccount,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

console.log('Bounty created:', tx);
```

### 3. Submit Work to Bounty

```typescript
// Derive work receipt PDA
const workId = Keypair.generate().publicKey;
const [receiptPda] = await PublicKey.findProgramAddress(
  [Buffer.from('receipt'), bountyPda.toBuffer(), workId.toBuffer()],
  programId
);

// Submit work
const workTx = await program.methods
  .submitWork({
    workId: workId,
    description: 'Implemented fix with test coverage',
    proofUrl: 'https://github.com/user/pr/123',
    metadata: {
      commitHash: 'abc123def456',
      testsPassed: true,
    },
  })
  .accounts({
    bounty: bountyPda,
    receipt: receiptPda,
    submitter: provider.wallet.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

console.log('Work submitted:', workTx);
```

### 4. Release Funds (After Acceptance)

```typescript
// Only bounty creator can release funds
const releaseTx = await program.methods
  .releaseEscrow({
    receiptId: workId,
  })
  .accounts({
    bounty: bountyPda,
    receipt: receiptPda,
    creator: provider.wallet.publicKey,
    solver: solverWalletAddress,
    escrow: escrowTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();

console.log('Funds released:', releaseTx);
```

### 5. Query Bounty State

```typescript
// Fetch bounty state from chain
const bountyState = await program.account.bounty.fetch(bountyPda);

console.log('Bounty:', {
  title: bountyState.title,
  creator: bountyState.creator.toString(),
  rewardAmount: bountyState.rewardAmount.toString(),
  deadline: new Date(bountyState.deadline.toNumber() * 1000),
  status: bountyState.status, // 'open', 'in_progress', 'completed'
  escrowAddress: bountyState.escrow.toString(),
});

// Fetch all receipts for a bounty
const receipts = await program.account.receipt.all([
  {
    memcmp: {
      offset: 8, // Skip discriminator
      bytes: bountyPda.toBase58(),
    },
  },
]);

console.log(`Found ${receipts.length} work submissions`);
```

## Integration Patterns

### For DAOs

Integrate BountyGraph for community governance work:

```typescript
// DAO can create bounties for governance tasks
const daoTreasuryPublicKey = dao.treasury;

const daoBouncyTx = await program.methods
  .createBounty({
    bountyId: PublicKey.unique(),
    title: 'Implement new voting mechanism',
    description: 'As per DAO proposal #123',
    rewardAmount: new BN(5_000_000_000), // 5 SOL from treasury
    deadline: new BN(proposalDeadline),
  })
  .accounts({
    bounty: bountyPda,
    creator: daoTreasuryPublicKey,
    escrow: escrowAccount,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### For Freelance Platforms

Build a freelance marketplace on top:

```typescript
// Platform creates bounties on behalf of clients
// Platform owns the escrow, takes commission

const platformBouncyTx = await program.methods
  .createBounty({
    bountyId: clientJobId,
    title: jobPosting.title,
    description: jobPosting.description,
    rewardAmount: new BN(jobPosting.priceInLamports * 1.05), // +5% platform fee
    deadline: new BN(jobPosting.deadline),
  })
  .accounts({
    bounty: bountyPda,
    creator: platformProgramAddress, // Platform controls funds
    escrow: platformEscrow,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

// After work accepted, platform releases funds to solver
// Platform retains 5% commission
```

### For Developer Tools

Integrate for bounty-based bug fixing:

```typescript
// Bug tracking tool creates bounties for critical issues
const GitHubIssueId = githubIssue.id;
const bountyAmount = calculateSeverity(githubIssue.severity);

const toolBouncyTx = await program.methods
  .createBounty({
    bountyId: new PublicKey(GitHubIssueId),
    title: `[BUG] ${githubIssue.title}`,
    description: githubIssue.body,
    rewardAmount: new BN(bountyAmount),
    deadline: new BN(30 * 86400), // 30 days to fix
  })
  .accounts({
    bounty: bountyPda,
    creator: toolTreasuryAddress,
    escrow: toolEscrow,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

## Common Pitfalls and Solutions

### ❌ Pitfall 1: Incorrect PDA Derivation

**Problem**: PDA seeds don't match BountyGraph's derivation.

**Solution**: Always use the exact seed structure:
```typescript
// CORRECT
const [pda] = await PublicKey.findProgramAddress(
  [Buffer.from('bounty'), bountyId.toBuffer()],
  programId
);

// WRONG - extra seeds cause different PDA
const [wrongPda] = await PublicKey.findProgramAddress(
  [Buffer.from('bounty'), bountyId.toBuffer(), Buffer.from('extra')],
  programId
);
```

### ❌ Pitfall 2: Insufficient SOL for Rent

**Problem**: Account creation fails due to insufficient rent deposits.

**Solution**: Always calculate rent:
```typescript
// Get rent exemption amount
const rentLamports = await connection.getMinimumBalanceForRentExemption(
  bountyDataSize // Get actual size from IDL
);

// Add to transaction budget
const tx = new Transaction().add(
  createAccountInstruction({
    lamports: rentLamports + buffer, // Add buffer
    space: bountyDataSize,
    owner: programId,
  })
);
```

### ❌ Pitfall 3: Race Condition on Escrow Release

**Problem**: Multiple releases attempted simultaneously.

**Solution**: Use transaction confirmation:
```typescript
// Wait for confirmation before next action
const signature = await program.methods
  .releaseEscrow(...)
  .rpc();

const confirmation = await connection.confirmTransaction(signature, 'confirmed');
if (!confirmation.value.err) {
  console.log('Funds safely released');
} else {
  throw new Error('Release failed');
}
```

### ❌ Pitfall 4: Token Account Validation

**Problem**: Wrong token account type (SPL vs native SOL).

**Solution**: Validate account ownership:
```typescript
const accountInfo = await connection.getAccountInfo(escrowAddress);
if (accountInfo?.owner.equals(TOKEN_PROGRAM_ID)) {
  // Valid SPL token account
} else if (accountInfo?.owner.equals(SystemProgram.programId)) {
  // Valid native SOL account
} else {
  throw new Error('Invalid escrow account');
}
```

## Dispute Resolution

When work is rejected, use the dispute mechanism:

```typescript
// Solver disputes rejection
const disputeTx = await program.methods
  .initiateDispute({
    receiptId: workId,
    reason: 'Creator rejected valid work without justification',
    evidence: 'https://ipfs.example.com/dispute-evidence',
  })
  .accounts({
    bounty: bountyPda,
    receipt: receiptPda,
    solver: provider.wallet.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

// After dispute resolution (manual DAO vote or arbitration)
// Releasing party calls:
const resolveTx = await program.methods
  .resolveDispute({
    receiptId: workId,
    outcome: 'approved', // or 'rejected'
  })
  .accounts({
    bounty: bountyPda,
    receipt: receiptPda,
    resolver: resolverAuthority,
  })
  .rpc();
```

## Queryable On-Chain State

All bounty and work state is queryable:

```typescript
// List all bounties (requires indexing)
const bounties = await program.account.bounty.all();

// Filter by creator
const creatorBounties = bounties.filter(b =>
  b.account.creator.equals(creatorAddress)
);

// Get bounty with receipts
const bountyWithWork = await program.account.receipt.all([
  { memcmp: { offset: 8, bytes: bountyPda.toBase58() } }
]);
```

## Fees and Economies

BountyGraph itself has no platform fees. However, you can:

1. **Build commission into bounty amount** (like freelance patterns above)
2. **Use separate treasury accounts** for escrow custody
3. **Implement reputation-based multipliers** (e.g., verified solvers get 20% bonus)
4. **Layer on governance tokens** for DAO integration

## Resources

- **GitHub**: https://github.com/neogenuity/bountygraph
- **IDL**: Available in repository `/programs/bountygraph/target/idl/bountygraph.json`
- **SDK Docs**: `@bountygraph/sdk` on npm
- **Examples**: See `examples/integration/quickstart.ts` for runnable code

## Support

For integration questions:
- Open an issue: https://github.com/neogenuity/bountygraph/issues
- Fork and extend: https://github.com/neogenuity/bountygraph
- Build on-chain: Your composable bounty protocol awaits
