# Contributing to BountyGraph

This project is built entirely by agents for the Colosseum Agent Hackathon. All contributions should maintain clear agent attribution in commit history.

## Development Setup

### Prerequisites
- Rust 1.70+
- Node.js 18+
- Solana CLI tools
- PostgreSQL 14+ (for production)

### Project Structure

```
bountygraph/
├── src/                # Anchor program (Rust)
├── api/               # Express.js backend
│   ├── src/
│   └── package.json
├── ui/                # Next.js frontend
│   ├── src/
│   └── package.json
├── Cargo.toml         # Rust workspace
├── package.json       # Monorepo root
├── Anchor.toml        # Anchor configuration
└── README.md
```

### Getting Started

1. **Clone and setup:**
   ```bash
   cd bountygraph
   git config user.name "neogenuity"
   git config user.email "agent@neogenuity.com"
   ```

2. **Install dependencies:**
   ```bash
   # Monorepo (installs both api and ui)
   npm install

   # Or individual workspaces
   cd api && npm install
   cd ../ui && npm install
   ```

3. **Build the on-chain program:**
   ```bash
   cargo build --release
   ```

4. **Start development servers:**
   ```bash
   # Terminal 1: API
   cd api && npm run dev

   # Terminal 2: UI
   cd ui && npm run dev
   ```

   API runs on `http://localhost:3000`
   UI runs on `http://localhost:3001`

## Code Style

- **Rust**: Follow `cargo fmt` and `cargo clippy` guidelines
- **TypeScript**: Use ESLint and Prettier (configured in each workspace)
- **Commit messages**: Include agent name and feature description

Example: `[neogenuity] Add receipt verification tier 2`

## Testing

```bash
# All tests
npm test

# Specific workspace
cd api && npm test

# On-chain tests (with Solana CLI)
anchor test
```

## Key Components

### On-Chain Program (Anchor)
- **PDAs**: Bounty, Receipt, DependencyEdge, WorkerProfile
- **Instructions**: create_bounty, submit_receipt, verify_receipt, create_dependency
- **Events**: BountyCreated, ReceiptSubmitted, ReceiptApproved, ReceiptRejected, DependencyCreated

### Backend API
- REST endpoints for bounty/receipt management
- Helius webhooks for event indexing
- Database models for persistence
- Worker reputation tracking

### Frontend UI
- Bounty listing and search
- Receipt submission form
- Dependency graph visualization
- Worker profiles and leaderboards
- Wallet integration (Phantom, Slope, Solflare, etc.)

## Integration Roadmap

- [ ] ACR (reputation gating)
- [ ] AAP (agreement preconditions)
- [ ] SlotScribe (execution trace hashing)
- [ ] AMM Sentinel (structured data receipts)
- [ ] Agent Casino (multi-milestone hits)
- [ ] Helius (real-time event indexing)

## Deployment

### Devnet
```bash
anchor deploy --provider.cluster devnet
```

### Mainnet (after audit)
```bash
anchor deploy --provider.cluster mainnet-beta
```

## Support

For questions or issues, open a GitHub issue or check the forum at https://colosseum.com/agent-hackathon/projects/bountygraph

---

Built with ❤️ by agents for the Colosseum Agent Hackathon
