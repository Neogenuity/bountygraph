# BountyGraph Deployment Guide

## Current Status

- **On-Chain Program**: Code complete, pending compilation validation
- **Backend API**: Ready for development deployment, needs PostgreSQL for production
- **Frontend UI**: Production-ready (static site, can deploy to Vercel/Netlify)
- **Devnet Readiness**: ⏳ In Progress (compilation validation pending)
- **Mainnet Readiness**: ⏳ Pending (security audit, gas optimization)

## Deployment Stages

### Stage 1: Devnet (Validation)
**Target**: Feb 11, 2026

1. **Compile on-chain program**
   ```bash
   cargo build --release
   ```

2. **Run test suite**
   ```bash
   anchor test
   ```

3. **Deploy to devnet**
   ```bash
   anchor deploy --provider.cluster devnet
   ```

4. **Update program ID in code**
   - Update `declare_id!()` in `src/lib.rs` with deployed program ID
   - Update program ID in API `.env`

5. **Start local API server**
   ```bash
   cd api
   npm install
   npm run dev
   ```

6. **Deploy frontend to Vercel**
   ```bash
   cd ui
   npm install
   npm run build
   vercel deploy --prod
   ```

### Stage 2: Integration Testing (Feb 11-12)
- Test bounty creation → receipt submission → verification → payout flow end-to-end
- Validate Helius webhook integration
- Test wallet connections (Phantom, Slope, Solflare)
- Verify ACR integration for reputation queries

### Stage 3: Mainnet-Beta (Feb 12)
**Prerequisites**:
- [ ] Security audit of on-chain program
- [ ] Mainnet RPC endpoint configured
- [ ] Production database (PostgreSQL) running
- [ ] API deployed to production (Railway, Heroku, AWS)
- [ ] UI deployed to production CDN

**Deploy to mainnet-beta**:
```bash
# Update cluster in Anchor.toml
# Update SOLANA_RPC_URL to mainnet endpoint
anchor deploy --provider.cluster mainnet-beta
```

## Environment Variables

### Development
See `api/.env.example`

### Production
```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
BOUNTYGRAPH_PROGRAM_ID=<devnet/mainnet program ID>
DATABASE_URL=postgresql://prod-user:pass@prod-host:5432/bountygraph
HELIUS_API_KEY=<your-api-key>
JWT_SECRET=<production-secret>
CORS_ORIGIN=https://yourdomain.com
```

## Monitoring

### Health Checks
- **API**: `GET /health` should return `{"status":"ok"}`
- **On-Chain**: Query recent transaction logs for program events
- **Database**: Connection pool health from PostgreSQL

### Metrics to Track
- Bounty creation rate (per hour)
- Receipt submission rate
- Verification success rate
- Average payout time
- Worker reputation distribution

### Logs
- Anchor program logs in Solana explorer
- API logs in server console/monitoring service
- UI error tracking (Sentry or similar)

## Rollback Plan

If critical issue detected:

1. **On-Chain**: Cannot rollback (immutable). Deploy patch program if needed.
2. **API**: Redeploy previous version
   ```bash
   git revert <commit>
   npm run build
   # redeploy
   ```
3. **Frontend**: Revert to previous Vercel deployment

## Checklist for Orchestrator

- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Devnet deployment successful
- [ ] API health check responds
- [ ] UI loads without errors
- [ ] Wallet connection works
- [ ] End-to-end bounty flow succeeds
- [ ] Events are emitted and indexed
- [ ] No critical security issues
- [ ] Performance is acceptable

## Contact

For deployment issues or questions, refer to CONTRIBUTING.md or GitHub issues.

---

**Last Updated**: Feb 10, 2026 23:53 UTC
**Next Phase**: Compilation validation & devnet deployment
