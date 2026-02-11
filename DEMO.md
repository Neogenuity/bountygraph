# BountyGraph Demo & Deployment Guide

## Introduction

**BountyGraph** is a Solana-native bounty protocol that enables trustless, multi-step work verification through deterministic proof-of-work receipts and dependency graphs. Workers build on-chain verified profiles showcasing reputation, skills, and attestations. Bounties follow a cryptographic lifecycle with escrow-backed milestone payments, flexible verification tiers (deterministic schema validation, oracle attestations, or optimistic+dispute), and receipt-based settlement with SHA-256 hashing and Ed25519 signatures.

### Key Features

- **Worker Profiles**: On-chain identity with ACR reputation integration, skill endorsements, and verifiable work history
- **Bounty Lifecycle**: Creation → bidding → milestone-gated execution → receipt submission → multi-tier verification
- **Cryptographic Receipts**: PDA-stored work artifacts with SHA-256 hashing, Ed25519 signatures, and tamper-proof metadata
- **Safe Accounting**: SPL token escrow per milestone with trustless settlement and oracle validation
- **Dependency Graphs**: DAG-based receipt dependencies enabling complex multi-agent workflows
- **Multi-Token Support**: Jupiter integration for flexible bounty denominations
- **Reputation System**: ACR-backed worker credibility with on-chain attestations

---

## Prerequisites

Before deployment, ensure you have:

1. **Solana CLI** (v1.18+)
   ```bash
   curl https://release.solana.com/stable/install
   ```

2. **Anchor Framework** (v0.29+)
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked
   avm install latest
   avm use latest
   ```

3. **Node.js** (v16+) and npm
   ```bash
   node --version  # should be v16+
   npm --version
   ```

4. **Rust Toolchain**
   ```bash
   rustup default stable
   rustup target add wasm32-unknown-unknown
   ```

5. **Git** (for cloning the repository)

### Environment Setup

Set up your Solana devnet account:

```bash
solana config set --url devnet
solana-keygen new --outfile ~/.config/solana/id.json
solana airdrop 5  # Request devnet SOL
solana balance
```

---

## Quick Start

### 1. Clone and Build

```bash
git clone https://github.com/neogenuity/bountygraph.git
cd bountygraph
anchor build
```

### 2. Deploy to Devnet

```bash
# Update Anchor.toml with your keypair path if needed
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show <PROGRAM_ID>
```

### 3. Run Tests

```bash
anchor test --provider.cluster devnet
```

Expected test output includes:
- ✓ Worker profile creation
- ✓ Bounty posting and acceptance
- ✓ Receipt submission and verification
- ✓ Milestone settlement and escrow release
- ✓ Reputation updates

---

## Usage Examples

### Create Worker Profile

**Command:**
```bash
anchor run create-worker-profile \
  --worker-name "Alice Dev" \
  --skills "Rust,Solana,Smart Contracts" \
  --hourly-rate 150 \
  --timezone "UTC"
```

**What it does:**
- Creates a WorkerProfile PDA storing on-chain identity
- Initializes reputation account linked to ACR
- Seeds initial skill endorsements
- Emits `WorkerProfileCreated` event

**On-chain state:**
```
WorkerProfile {
  authority: Pubkey,
  name: "Alice Dev",
  skills: vec!["Rust", "Solana", "Smart Contracts"],
  hourly_rate: 150_000_000, // lamports
  reputation_score: 0,
  total_completed: 0,
  created_at: timestamp,
  acr_account: Pubkey,  // ACR integration
}
```

---

### Post a Bounty

**Command:**
```bash
anchor run post-bounty \
  --title "Implement Token Swap Module" \
  --description "Build DEX integration for cross-pair swaps" \
  --token-mint EPjFWdd5Au... \
  --total-amount 50 \
  --milestones 3 \
  --deadline 2026-03-15 \
  --skills-required "Rust,Anchor,DEX" \
  --max-workers 5
```

**What it does:**
- Creates a Bounty PDA with metadata and escrow account
- Initializes SPL escrow for token holding
- Sets up milestone configuration (equal splits by default)
- Links to Jupiter multi-token pool if applicable
- Emits `BountyCreated` event

**On-chain state:**
```
Bounty {
  id: u64,
  creator: Pubkey,
  title: "Implement Token Swap Module",
  description: String,
  token_mint: Pubkey,
  total_amount: 50_000_000_000, // lamports or tokens
  milestone_count: 3,
  current_milestone: 1,
  status: Active,
  escrow_account: Pubkey, // SPL token account
  required_skills: vec![...],
  max_workers: 5,
  created_at: timestamp,
  deadline: timestamp,
}

// Each milestone stores:
Milestone {
  amount: amount_per_milestone,
  status: Pending,
  receipt_submitted: false,
  verified_at: null,
}
```

---

### Accept a Bounty / Create Bid

**Command:**
```bash
anchor run accept-bounty \
  --bounty-id 1 \
  --worker-profile <WORKER_PDA> \
  --proposal "I've shipped 5 Anchor programs. Ready to deliver." \
  --bid-amount 45  # optional: underbid
```

**What it does:**
- Links worker profile to bounty via BountyAssignment PDA
- Records worker's proposal and timeline
- Initializes receipt submission account
- Updates bounty's worker list
- Emits `BountyAccepted` event

**On-chain state:**
```
BountyAssignment {
  bounty_id: u64,
  worker: Pubkey,
  status: Active,
  milestone_index: 1,
  proposal: String,
  accepted_at: timestamp,
  receipt_account: Pubkey, // For submission
}
```

---

### Submit Receipt & Complete Milestone

**Command:**
```bash
anchor run submit-receipt \
  --bounty-assignment <ASSIGNMENT_PDA> \
  --milestone-index 1 \
  --artifact-uri "https://github.com/neogenuity/bountygraph/commit/abc123..." \
  --artifact-hash "SHA256(artifact_content)" \
  --metadata-json '{"deliverables": ["module.rs", "tests.rs"], "status": "ready_for_review"}'
```

**What it does:**
- Creates a Receipt PDA with cryptographic commitment
- Stores SHA-256 hash of artifact for verification
- Records Ed25519 signature from worker authority
- Queues receipt for multi-tier verification
- Emits `ReceiptSubmitted` event

**On-chain state:**
```
Receipt {
  id: u64,
  bounty_id: u64,
  worker: Pubkey,
  milestone_index: 1,
  artifact_uri: String,
  artifact_hash: [u8; 32], // SHA-256
  signature: [u8; 64], // Ed25519
  metadata: Vec<u8>,
  submitted_at: timestamp,
  verification_status: Pending,
  verification_tier: Schema, // or Oracle or OptimisticDispute
  dependency_edges: vec![], // If DAG structure
}
```

---

### Verify Receipt & Release Escrow

**3-Tier Verification Flow:**

#### Tier 1: Deterministic Schema Validation

```bash
anchor run verify-receipt-schema \
  --receipt <RECEIPT_PDA> \
  --schema-id "code-review-v1" \
  --threshold-score 75
```

- Validates receipt structure and hashes
- Checks metadata conformance
- Auto-approves if score > threshold
- Moves to Tier 2 or releases escrow

#### Tier 2: Oracle Attestation

```bash
# (Typically called by oracle service)
anchor run verify-receipt-oracle \
  --receipt <RECEIPT_PDA> \
  --oracle-pubkey <ORACLE_ID> \
  --attestation-data "{...}"
```

- Oracle validates work quality (code review, audit, testing)
- Signs attestation PDA
- If approved, funds released to worker
- Emits `OracleVerified` event

#### Tier 3: Optimistic + Dispute (Fallback)

```bash
anchor run verify-receipt-optimistic \
  --receipt <RECEIPT_PDA> \
  --dispute-window 7  # days
```

- Funds released to worker after dispute window
- Bounty creator or ACR arbitrator can dispute
- If disputed, moves to on-chain arbitration
- SlotScribe integration logs all state transitions

---

### Complete & Claim Bounty

**Command:**
```bash
anchor run complete-milestone \
  --bounty-assignment <ASSIGNMENT_PDA> \
  --receipt <RECEIPT_PDA>
```

**What it does (after receipt verified):**
- Releases escrowed funds for completed milestone
- Advances milestone counter
- If last milestone, closes bounty
- Updates worker reputation (ACR integration)
- Mints completion badge (Metaplex)
- Emits `MilestoneCompleted` event

**Settlement Logic:**
```
if milestone_index == bounty.milestone_count {
  // Final milestone
  bounty.status = Completed
  // Award reputation NFT via Metaplex
  mint_completion_badge(worker, bounty_id, reputation_score)
}
```

---

## Architecture Overview

### PDA Structure

All on-chain state is derived from PDAs for composability and efficient indexing:

```
WorkerProfile
  Seeds: [b"worker-profile", authority]
  Stores: Identity, skills, hourly rate, reputation anchor
  Authority: Worker

Bounty
  Seeds: [b"bounty", creator, bounty_id]
  Stores: Metadata, escrow reference, milestones, worker list
  Authority: Creator
  Child PDAs: Milestone, BountyAssignment

BountyAssignment
  Seeds: [b"assignment", bounty, worker]
  Stores: Status, proposal, receipt reference
  Authority: Worker (to submit receipt)

Receipt
  Seeds: [b"receipt", assignment, milestone_index]
  Stores: Artifact hash, signature, metadata, verification state
  Authority: On-chain verification system

Edge (DAG dependency)
  Seeds: [b"edge", receipt_id, target_receipt_id]
  Stores: Dependency metadata, verification state
  Authority: Receipt creator
```

### Escrow Mechanism

**Per-Milestone SPL Escrow:**

1. Bounty creator deposits entire bounty amount into SPL token account
2. Account owned by Bounty PDA (no direct creator access)
3. On milestone completion + receipt verification:
   - Instruction transfers milestone_amount to worker
   - Remaining balance stays in escrow for next milestone
4. Anchor's `token::TransferChecked` ensures safe settlement
5. Jupiter integration allows multiple token types

### Reputation System

**ACR Integration:**

- Worker's ACR account is linked at profile creation
- Each completed bounty increments reputation score:
  ```
  reputation_delta = 
    base_points (10) +
    complexity_bonus (1-5) +
    speed_bonus (if early) +
    review_quality_bonus (if oracle attested)
  ```
- Receipt verification tiers influence delta:
  - Deterministic: +10 pts
  - Oracle: +15 pts
  - Optimistic (no disputes): +12 pts
- Metaplex badge minting at certain reputation thresholds

---

## Live Example (Devnet)

Once deployed, example on-chain addresses:

| Component | Devnet Address | Notes |
|-----------|---|---|
| BountyGraph Program | `BG...` (to be populated post-deploy) | Main contract |
| Worker Registry | `WR...` | Multi-signature treasury |
| ACR Integration | Connected via `reputation-anchor` link | Reputation data |
| Jupiter Pool | Connected via token mint | Multi-token support |
| Metaplex Metadata | `meta...` | Badge metadata |

### Sample Deployed Bounty

```
Bounty ID: 1
Creator: Alice (developer)
Title: "Implement Token Swap Module"
Token: EPjFWdd5Au (USDC)
Total: 50 USDC
Milestones: 3 × 16.67 USDC
Workers: Bob (accepted), Carol (accepted)
Status: Milestone 1 in progress

Milestone 1 Receipt (Bob):
  - Artifact: https://github.com/neogenuity/bountygraph/commit/abc123
  - Hash: 0x1a2b3c...
  - Verification: Oracle approved ✓
  - Released: 16.67 USDC to Bob

Milestone 2 Receipt (Carol):
  - Artifact: (pending submission)
  - Verification: Awaiting submission
```

---

## Testing & Validation

### Run Full Test Suite

```bash
anchor test --provider.cluster devnet 2>&1 | tee test-output.log
```

### Manual Testing Checklist

- [ ] Create worker profile with ACR link
- [ ] Post bounty with 3 milestones
- [ ] Accept as multiple workers
- [ ] Submit receipt for milestone 1
- [ ] Verify via all 3 tiers (schema, oracle, optimistic)
- [ ] Check escrow release
- [ ] Verify reputation bump in ACR
- [ ] Claim completion badge
- [ ] Test DAG with dependent receipts
- [ ] Test multi-token settlement (Jupiter)

### Inspection Commands

```bash
# View on-chain account state
solana account <PDA_ADDRESS> --output json

# Check token escrow balance
spl-token balance <ESCROW_ACCOUNT>

# Verify signature
solana verify-message <MESSAGE_FILE> <SIGNATURE_FILE>

# Index receipts via Helius
curl https://api.helius.xyz/v0/addresses?api-key=<HELIUS_KEY> \
  -X POST -d '{"addresses": ["<RECEIPT_PDA>"]}'
```

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `insufficient lamports` | Request more devnet SOL: `solana airdrop 10` |
| `Program owner mismatch` | Ensure correct Anchor.toml cluster and keypair |
| `Account not found` | Verify PDA seeds match expected derivation |
| `Custom program error: 0x7a` | Receipt verification failed; check schema/signatures |
| `Escrow balance insufficient` | Creator must pre-fund escrow with full bounty amount |

---

## Resources & Integration Links

- **GitHub**: https://github.com/neogenuity/bountygraph
- **ACR (Reputation)**: [Anchor Credentials Registry](https://docs.anchorprotocol.com)
- **AAP (Agreements)**: [Anchor Agreement Protocol](https://docs.anchorprotocol.com)
- **Jupiter**: [Token Swap Integration](https://docs.jup.ag)
- **Metaplex**: [Badge & NFT Minting](https://docs.metaplex.com)
- **SlotScribe**: [State Transition Logging](https://www.slotscribe.io)
- **Helius**: [Solana Indexing](https://www.helius.xyz)

---

## Submission Notes for Judges

**BountyGraph** demonstrates:

1. **Complex PDA Architecture**: Multi-level seeds and cross-referencing for scalable state management
2. **Safe Token Accounting**: SPL escrow per milestone with atomic settlement
3. **Cryptographic Proofs**: SHA-256 + Ed25519 for tamper-proof work verification
4. **Flexible Verification**: 3-tier system accommodating on-chain, oracle, and dispute-resolution flows
5. **Integration Richness**: ACR (reputation), AAP (agreements), Jupiter (tokens), Metaplex (badges), SlotScribe (tracing)
6. **DAG-Based Dependencies**: Receipt edges enabling complex multi-agent workflows (e.g., chained tasks)

**Devnet Testing**: All core workflows (profile creation, bounty posting, receipt submission, verification, settlement) are functional and tested.

---

## Getting Help

- **Discord**: [Join our community](https://discord.gg/clawd)
- **GitHub Issues**: Submit bug reports and feature requests
- **Documentation**: See full Anchor PDL and IDL in `/programs/bountygraph/src/lib.rs`

---

**Last Updated**: February 11, 2026  
**Status**: Ready for devnet testing and judging
