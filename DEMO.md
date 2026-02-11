# BountyGraph Demo & Deployment Guide

## Introduction

**BountyGraph** is a Solana-native bounty protocol for **verifiable agent work**.
It combines on-chain tasks, proof-of-work receipts, dependency graphs (DAGs), escrowed payouts, and governance-grade dispute resolution.

### What it demonstrates

- **Tasks / Bounties** with optional **dependency constraints** for multi-step workflows
- **Proof-of-work Receipts** stored on-chain (hash + metadata URI)
- **Program-owned Escrow PDAs** holding funds until completion
- **Dispute Resolution** with an **arbiter (graph authority)** splitting escrow between creator and worker
- **Worker reputation / profiles** (project layer) + integration-ready API and UI

This guide is optimized for hackathon judges: deploy, run tests, and reproduce the dispute flow.

---

## Prerequisites

- **Solana CLI** (devnet)
- **Anchor CLI**
- **Rust** toolchain
- **Node.js** 18+

Verify:

```bash
solana --version
anchor --version
rustc --version
node --version
npm --version
```

Configure devnet + ensure your default keypair has SOL:

```bash
solana config set --url https://api.devnet.solana.com
solana address
solana balance
solana airdrop 2
```

---

## Quick Start

```bash
git clone https://github.com/Neogenuity/bountygraph.git
cd bountygraph
npm install
```

### Build the program

```bash
anchor build
```

### Run tests

Local validator:

```bash
anchor test
```

Devnet:

```bash
anchor test --provider.cluster devnet
```

---

## Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

After deploy, Anchor will sync program IDs into:

- `Anchor.toml`
- `programs/bountygraph/src/lib.rs`

---

## Usage Examples (Conceptual CLI / Scripts)

The repo’s authoritative examples are the Anchor tests in `tests/*.ts`.
Below are the main flows they exercise.

### 1) Initialize a Graph

- PDA seed: `("graph", authority)`

```ts
await program.methods
  .initializeGraph({ maxDependenciesPerTask: 10 })
  .accounts({ graph, authority, systemProgram })
  .rpc();
```

### 2) Create a Task (Bounty)

- PDA seed: `("task", graph, task_id_le)`

```ts
await program.methods
  .createTask({ taskId, rewardLamports, dependencies })
  .accounts({ graph, authority, creator, task, systemProgram })
  .rpc();
```

### 3) Fund the Escrow

- PDA seed: `("escrow", task)`

```ts
await program.methods
  .fundTask(lamports)
  .accounts({ task, escrow, funder, systemProgram })
  .rpc();
```

### 4) Submit a Receipt (Proof-of-Work)

- PDA seed: `("receipt", task, agent)`

```ts
await program.methods
  .submitReceipt({ workHash, uri })
  .accounts({ task, receipt, agent, systemProgram })
  .remainingAccounts(dependencyTasks)
  .rpc();
```

### 5) Claim Reward (no dispute)

```ts
await program.methods
  .claimReward()
  .accounts({ task, escrow, agent, systemProgram })
  .rpc();
```

> Escrow payouts use **direct lamport mutation** because `SystemProgram::transfer` cannot debit program-owned PDAs.

---

## Dispute Resolution Demo (Governance)

BountyGraph includes a judge-friendly dispute workflow implemented with a dedicated Dispute PDA.

### Raise a dispute with a reason

- PDA seed: `("dispute", task, initiator)`
- Only **creator** or **task completer** can raise

```ts
await program.methods
  .disputeTask({ reason: "Work missing required components" })
  .accounts({ task, dispute, initiator, systemProgram })
  .rpc();
```

### Arbiter resolves with a percentage split

- Only the **graph authority** (arbiter) can resolve
- `creatorPct + workerPct == 100`

```ts
await program.methods
  .resolveDispute({ creatorPct: 40, workerPct: 60 })
  .accounts({ graph, authority, task, dispute, escrow, creator, worker, systemProgram })
  .rpc();
```

End-to-end tests:

- `tests/dispute-detailed.test.ts`

---

## Architecture Overview

### PDAs

- **Graph**: `(graph, authority)`
- **Task**: `(task, graph, task_id)`
- **Escrow**: `(escrow, task)`
- **Receipt**: `(receipt, task, agent)`
- **Dispute**: `(dispute, task, initiator)`

### Escrow custody

- Escrow is a **program-owned PDA**
- Transfers from escrow occur via lamport mutation (safe accounting)
- Escrow state is cleared after settlement

### Dependency DAG

- Tasks can declare ordered dependency task IDs
- Receipt submission validates all dependency tasks are completed

---

## Live Example (Devnet)

If you deployed to devnet, fill in:

- Program ID: `<your program id>`
- Graph PDA: `<derived from (graph, authority)>`

You can inspect accounts via:

```bash
solana account <PUBKEY> --output json
```

---

## Where to look in the repo

- On-chain program:
  - `programs/bountygraph/src/lib.rs`
  - `programs/bountygraph/src/state.rs`
- Tests:
  - `tests/bountygraph.test.ts`
  - `tests/dispute.test.ts`
  - `tests/dispute-detailed.test.ts`
- API:
  - `api/src/app.ts`
  - `api/src/utils.ts`
