import * as anchor from '@coral-xyz/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as assert from 'assert';

describe('bountygraph detailed dispute mechanism with reasons', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Bountygraph as anchor.Program;
  const authority = (provider.wallet as anchor.Wallet).payer;

  const deriveGraphPda = (authorityPk: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('graph'), authorityPk.toBuffer()],
      program.programId
    );

  const deriveTaskPda = (graphPk: PublicKey, taskId: anchor.BN) =>
    PublicKey.findProgramAddressSync(
      [
        Buffer.from('task'),
        graphPk.toBuffer(),
        taskId.toArrayLike(Buffer, 'le', 8),
      ],
      program.programId
    );

  const deriveEscrowPda = (taskPk: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), taskPk.toBuffer()],
      program.programId
    );

  const deriveReceiptPda = (taskPk: PublicKey, agentPk: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('receipt'), taskPk.toBuffer(), agentPk.toBuffer()],
      program.programId
    );

  const deriveDisputePda = (taskPk: PublicKey, initiatorPk: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('dispute'), taskPk.toBuffer(), initiatorPk.toBuffer()],
      program.programId
    );

  const airdrop = async (kp: Keypair, sol: number) => {
    const sig = await provider.connection.requestAirdrop(
      kp.publicKey,
      sol * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, 'confirmed');
  };

  const ensureGraph = async () => {
    const [graphPda] = deriveGraphPda(authority.publicKey);
    try {
      await program.account.graph.fetch(graphPda);
      return graphPda;
    } catch {
      await program.methods
        .initializeGraph({ maxDependenciesPerTask: 10 })
        .accounts({
          graph: graphPda,
          authority: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      return graphPda;
    }
  };

  before(async () => {
    await ensureGraph();
  });

  it('dispute_task: creator can raise dispute with detailed reason', async () => {
    const creator = Keypair.generate();
    const worker = Keypair.generate();

    await airdrop(creator, 2);
    await airdrop(worker, 1);

    const graphPda = await ensureGraph();
    const taskId = new anchor.BN(3001);
    const [taskPda] = deriveTaskPda(graphPda, taskId);

    // Create and fund task
    await program.methods
      .createTask({ taskId, rewardLamports: new anchor.BN(1_000_000), dependencies: [] })
      .accounts({
        graph: graphPda,
        authority: authority.publicKey,
        creator: creator.publicKey,
        task: taskPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, creator])
      .rpc();

    const [escrowPda] = deriveEscrowPda(taskPda);
    await program.methods
      .fundTask(new anchor.BN(600_000))
      .accounts({
        task: taskPda,
        escrow: escrowPda,
        funder: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Submit receipt
    const [receiptPda] = deriveReceiptPda(taskPda, worker.publicKey);
    const workHash = Array.from(Buffer.alloc(32, 42));

    await program.methods
      .submitReceipt({ workHash, uri: 'ipfs://detailed-test-1' })
      .accounts({
        task: taskPda,
        receipt: receiptPda,
        agent: worker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([worker])
      .rpc();

    // Creator raises dispute with detailed reason
    const [disputePda] = deriveDisputePda(taskPda, creator.publicKey);
    const reason = 'Work does not meet quality standards; missing critical components';

    await program.methods
      .disputeTask({ reason })
      .accounts({
        task: taskPda,
        dispute: disputePda,
        initiator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Verify dispute was created with correct details
    const disputeAccount: any = await program.account.dispute.fetch(disputePda);
    assert.equal(disputeAccount.raisedBy.toString(), creator.publicKey.toString());
    assert.equal(disputeAccount.reason, reason);
    assert.ok(disputeAccount.status.raised, 'dispute status should be raised');
  });

  it('resolve_dispute: arbiter can split funds based on percentage', async () => {
    const creator = Keypair.generate();
    const worker = Keypair.generate();

    await airdrop(creator, 2);
    await airdrop(worker, 1);

    const graphPda = await ensureGraph();
    const taskId = new anchor.BN(3002);
    const [taskPda] = deriveTaskPda(graphPda, taskId);

    // Setup task and dispute
    await program.methods
      .createTask({ taskId, rewardLamports: new anchor.BN(1_000_000), dependencies: [] })
      .accounts({
        graph: graphPda,
        authority: authority.publicKey,
        creator: creator.publicKey,
        task: taskPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, creator])
      .rpc();

    const [escrowPda] = deriveEscrowPda(taskPda);
    await program.methods
      .fundTask(new anchor.BN(1_000_000))
      .accounts({
        task: taskPda,
        escrow: escrowPda,
        funder: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const [receiptPda] = deriveReceiptPda(taskPda, worker.publicKey);
    const workHash = Array.from(Buffer.alloc(32, 51));

    await program.methods
      .submitReceipt({ workHash, uri: 'ipfs://detailed-test-2' })
      .accounts({
        task: taskPda,
        receipt: receiptPda,
        agent: worker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([worker])
      .rpc();

    // Worker raises dispute
    const [disputePda] = deriveDisputePda(taskPda, worker.publicKey);
    await program.methods
      .disputeTask({ reason: 'Creator cancelled project without valid reason' })
      .accounts({
        task: taskPda,
        dispute: disputePda,
        initiator: worker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([worker])
      .rpc();

    // Record balances before resolution
    const creatorBalBefore = await provider.connection.getBalance(creator.publicKey, 'confirmed');
    const workerBalBefore = await provider.connection.getBalance(worker.publicKey, 'confirmed');
    const escrowBalBefore = await provider.connection.getBalance(escrowPda, 'confirmed');

    // Authority resolves with 40% to creator, 60% to worker
    await program.methods
      .resolveDispute({ creatorPct: 40, workerPct: 60 })
      .accounts({
        graph: graphPda,
        authority: authority.publicKey,
        task: taskPda,
        dispute: disputePda,
        escrow: escrowPda,
        creator: creator.publicKey,
        worker: worker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Verify balances changed correctly
    const creatorBalAfter = await provider.connection.getBalance(creator.publicKey, 'confirmed');
    const workerBalAfter = await provider.connection.getBalance(worker.publicKey, 'confirmed');
    const escrowBalAfter = await provider.connection.getBalance(escrowPda, 'confirmed');

    const expectedCreatorAmount = Math.floor((escrowBalBefore * 40) / 100);
    const expectedWorkerAmount = escrowBalBefore - expectedCreatorAmount;

    // Allow for transaction fees (within 10,000 lamports tolerance)
    assert.ok(
      creatorBalAfter - creatorBalBefore >= expectedCreatorAmount - 10000,
      'Creator should receive ~40% of escrow'
    );
    assert.ok(
      workerBalAfter - workerBalBefore >= expectedWorkerAmount - 10000,
      'Worker should receive ~60% of escrow'
    );
    assert.equal(escrowBalAfter, 0, 'Escrow should be empty after resolution');

    // Verify dispute was resolved
    const disputeAccount: any = await program.account.dispute.fetch(disputePda);
    assert.ok(disputeAccount.status.resolved, 'dispute status should be resolved');
    assert.equal(disputeAccount.creatorPct, 40);
    assert.equal(disputeAccount.workerPct, 60);
    assert.equal(disputeAccount.arbiter.toString(), authority.publicKey.toString());
  });

  it('resolve_dispute: rejects invalid percentage splits that do not sum to 100', async () => {
    const creator = Keypair.generate();
    const worker = Keypair.generate();

    await airdrop(creator, 2);
    await airdrop(worker, 1);

    const graphPda = await ensureGraph();
    const taskId = new anchor.BN(3003);
    const [taskPda] = deriveTaskPda(graphPda, taskId);

    // Setup task and dispute
    await program.methods
      .createTask({ taskId, rewardLamports: new anchor.BN(1_000_000), dependencies: [] })
      .accounts({
        graph: graphPda,
        authority: authority.publicKey,
        creator: creator.publicKey,
        task: taskPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, creator])
      .rpc();

    const [escrowPda] = deriveEscrowPda(taskPda);
    await program.methods
      .fundTask(new anchor.BN(500_000))
      .accounts({
        task: taskPda,
        escrow: escrowPda,
        funder: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const [receiptPda] = deriveReceiptPda(taskPda, worker.publicKey);
    const workHash = Array.from(Buffer.alloc(32, 60));

    await program.methods
      .submitReceipt({ workHash, uri: 'ipfs://detailed-test-3' })
      .accounts({
        task: taskPda,
        receipt: receiptPda,
        agent: worker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([worker])
      .rpc();

    const [disputePda] = deriveDisputePda(taskPda, creator.publicKey);
    await program.methods
      .disputeTask({ reason: 'Testing invalid split' })
      .accounts({
        task: taskPda,
        dispute: disputePda,
        initiator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Attempt resolution with invalid split (90 + 5 = 95, not 100)
    try {
      await program.methods
        .resolveDispute({ creatorPct: 90, workerPct: 5 })
        .accounts({
          graph: graphPda,
          authority: authority.publicKey,
          task: taskPda,
          dispute: disputePda,
          escrow: escrowPda,
          creator: creator.publicKey,
          worker: worker.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      assert.fail('Should have rejected invalid percentage split');
    } catch (err: any) {
      assert.ok(err.message.includes('InvalidSplit'), 'Should reject split not summing to 100');
    }
  });
});
