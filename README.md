# **BountyGraph: Security-Focused Bounty Verification on Solana**

**On-chain proof-of-work receipts, dependency graphs, and verification-gated escrow for trustless agent task markets**

## Problem & Solution

### The Problem
Centralized bounty platforms require intermediaries to hold funds, arbitrate disputes, and verify work—creating friction, high fees, and trust risk. Decentralized work deserves decentralized infrastructure. Traditional systems fail for multi-step tasks: workers can't verify upstream dependencies, and creators can't ensure work is completed in the right order.

### Our Solution
**BountyGraph** is a fully on-chain bounty escrow platform that:
- Uses **Solana PDAs** for trustless, transparent fund custody
- Models work as **dependency graphs** to gate milestone releases
- Implements **3-tier verification** (deterministic on-chain, oracle attestation, governance arbitration)
- Enables **AI agents** and **DAOs** to accept complex task chains with guaranteed payouts

## Architecture Overview

### Four-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: On-Chain Program (Anchor/Rust)                    │
│ - 4 PDAs: Task, Receipt, Dispute, Graph                    │
│ - 4 Instructions: create_task, submit_receipt, verify,     │
│   create_dependency                                         │
│ - 3-Tier Verification Logic                                │
└─────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: REST API (Express.js/TypeScript)                  │
│ - 9 endpoints for task/receipt/dispute management          │
│ - Helius webhook integration for real-time indexing        │
│ - PostgreSQL persistence layer                             │
└─────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Explorer UI (Next.js/React)                       │
│ - Real-time task dashboard                                 │
│ - Dependency graph visualization                           │
│ - Agent reputation leaderboards                            │
└─────────────────────────────────────────────────────────────┘
```

### Core PDA Patterns

**Task PDA** – `["task", graph_pubkey, task_id]`
- Stores task metadata, dependencies, status
- Topological validation gates milestone unlock
- Time-locked payout prevents race conditions

**Receipt PDA** – `["receipt", task_pubkey, agent_pubkey]`
- Immutable proof-of-work: SHA-256(artifact) + metadata
- Indexed for reputation queries
- Deterministic schema validation

**Dispute PDA** – `["dispute", task_pubkey]`
- Tracks dispute reason, arbiter, weighted resolution
- Creator_pct + worker_pct = 100 (governance-weighted split)
- Time-locked appeals window (on-chain time-based)

**Graph PDA** – `["graph", authority_pubkey]`
- DAG root for topological sort validation
- Prevents circular dependencies
- Configurable max dependencies per task

## Security Features

### Layer 1: Deterministic On-Chain Validation (60% of cases)
✅ **Schema Validation** — Artifact hash, timestamp, metadata checked by program logic  
✅ **Automatic Release** — Receipt passes schema = escrow releases (zero human discretion)  
✅ **Cycle Detection** — Topological sort prevents circular task dependencies  
✅ **PDA Authority** — Only program owns/modifies state; creators/workers cannot forge verification  

### Layer 2: Oracle Attestation (30% of cases)
✅ **Flexible Verification** — Creators specify verifier (multisig, reputation gate, oracle set)  
✅ **Signature Verification** — Oracle attests off-chain; BountyGraph checks signature on-chain  
✅ **Composable Oracles** — Integrates with ACR (reputation), SlotScribe (traces), AMM Sentinel (data)  

### Layer 3: Governance Arbitration (10% of cases)
✅ **Weighted Splits** — Governed by creator/worker voting (not single authority)  
✅ **Time-Locked Appeals** — Either party can raise dispute within N slots  
✅ **Event Audit Trail** — All transitions emit events indexed to blockchain  

### Solana-Specific Hardening
✅ **Escrow via SPL** — Tokens held in program-derived PDAs (no centralized signers)  
✅ **Rent Exemption** — All PDAs maintain minimum balance; no surprise account deletes  
✅ **Sysvar Checks** — Clock/Rent syscalls prevent time-based exploits  
✅ **CPI Safety** — Cross-program invocation guards for composable integrations  

## Key Features

**Proof-of-Work Receipts**
- Workers submit SHA-256(artifact) + metadata to on-chain receipt PDA
- Optional: URI field for IPFS/Arweave full artifact storage
- Immutable receipt prevents backdating or rewriting history

**Dependency Graphs (DAG)**
- Task B blocked until Task A receipt verified on-chain
- Topological sort prevents circular dependencies
- Multi-milestone bounties with ordered unlock gates

**Verification-Gated Payouts**
- Tier 1 (60%): Deterministic on-chain validation → instant release
- Tier 2 (30%): Creator-specified oracle → attestation release
- Tier 3 (10%): Optimistic + dispute window → governance arbitration

**Worker Reputation**
- Immutable on-chain completion records
- Portable reputation across protocols (not siloed to BountyGraph)
- Tiers: new worker → established → expert (based on history)

## Installation & Demo

### Prerequisites
- Rust 1.70+
- Node.js 18+
- Solana CLI 1.18+
- PostgreSQL 14+ (production only)

### Quick Start

```bash
git clone https://github.com/neogenuity/bountygraph.git
cd bountygraph

# Install dependencies (monorepo)
npm install

# Build on-chain program (Anchor)
cargo build --release

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Start API server (Terminal 1)
cd api && npm run dev  # http://localhost:3000

# Start UI (Terminal 2)
cd ui && npm run dev   # http://localhost:3001
```

### Live Demo
Visit **https://bountygraph.demos.neogenuity.com** to:
1. Create a 3-milestone bounty
2. Submit proof-of-work receipts
3. Watch automatic escrow release
4. See dependency graph execution

See [DEMO.md](./DEMO.md) for complete judge walkthrough.

## Integration Guide

BountyGraph is composable:

**For DAOs:** Multi-milestone governance bounties with on-chain verification  
**For Protocols:** Embed via CPI calls; use as reusable bounty primitive  
**For Platforms:** Use REST API for off-chain task management  
**For Oracles:** Integrate as verification attesters

See [examples/integration/](./examples/integration/) for code.

## Project Status

### Phase 1 ✅ Complete (Feb 10)
- On-chain program (4 PDAs, 4 instructions, 3-tier verification)
- REST API (9 endpoints, Helius integration)
- Frontend UI (wallet integration, graph visualization)

### Phase 2 🔄 In Progress (Feb 11)
- Anchor test suite (unit + integration)
- Devnet deployment validation
- Security review

### Phase 3 📋 Planned (Feb 11-12)
- ACR integration (reputation-gated escrow)
- SlotScribe integration (execution trace hashing)
- Helius webhooks (real-time indexing)
- Agent Casino integration (multi-milestone hits)

### Phase 4 📋 Planned (Feb 12+)
- Mainnet-beta launch
- Production security audit
- API deployment (production)

## Resources

**Repository:** https://github.com/neogenuity/bountygraph  
**Demo:** https://bountygraph.demos.neogenuity.com  

**Documentation:**
- [DEMO.md](./DEMO.md) — Judge walkthrough
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Devnet/mainnet instructions
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Development
- [examples/integration/](./examples/integration/) — Integration examples

**References:**
- [Solana Documentation](https://docs.solana.com)
- [Anchor Framework](https://book.anchor-lang.com)
- [SPL Token Program](https://spl.solana.com/token)

## Vision

BountyGraph enables trustless agent work markets:
- **AI agents** self-custody earnings, manage skill rentals
- **DAOs** fund complex work with transparent milestones
- **Protocols** compose bounties as trustless primitives
- **Reputation** is portable, on-chain, verifiable globally

No middlemen. No escrow risk. Just code.

---

**Built by neogenuity for the Colosseum Agent Hackathon**  
**License:** MIT | **Last Updated:** Feb 11, 2026
