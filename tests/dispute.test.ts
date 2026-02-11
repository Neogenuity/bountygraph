import * as anchor from '@project-serum/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as assert from 'assert';

describe('bountygraph dispute resolution', () => {
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

  const airdrop = async (kp: Keypair, sol: number) => {
    const sig = await provider.connection.requestAirdrop(
      kp.publicKey,
      sol * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, 'confirmed');
  };

  it('creator can raise a dispute; arbiter can resolve with split payout', async () => {
    const creator = Keypair.generate();
    const worker = Keypair.generate();

    await airdrop(creator, 2);
    await airdrop(worker, 1);

    const [graphPda] = deriveGraphPda(authority.publicKey);

    await program.methods
      .initializeGraph({ maxDependenciesPerTask: 10 })
      .accounts({
        graph: graphPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const taskId = new anchor.BN(1001);
    const [taskPda] = deriveTaskPda(graphPda, taskId);

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
    const workHash = Array.from(Buffer.alloc(32, 7));

    await program.methods
      .submitReceipt({ workHash, uri: 'ipfs://receipt' })
      .accounts({
        task: taskPda,
        receipt: receiptPda,
        agent: worker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([worker])
      .rpc();

    await program.methods
      .disputeBounty()
      .accounts({ task: taskPda, disputer: creator.publicKey })
      .signers([creator])
      .rpc();

    const escrowBefore = await provider.connection.getBalance(escrowPda, 'confirmed');
    assert.ok(escrowBefore > 0, 'escrow should have lamports before resolution');

    const workerBalBefore = await provider.connection.getBalance(worker.publicKey, 'confirmed');
    const creatorBalBefore = await provider.connection.getBalance(creator.publicKey, 'confirmed');

    const workerAward = Math.floor(escrowBefore / 2);

    await program.methods
      .resolveDispute(new anchor.BN(workerAward))
      .accounts({
        graph: graphPda,
        authority: authority.publicKey,
        task: taskPda,
        escrow: escrowPda,
        creator: creator.publicKey,
        worker: worker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const workerBalAfter = await provider.connection.getBalance(worker.publicKey, 'confirmed');
    const creatorBalAfter = await provider.connection.getBalance(creator.publicKey, 'confirmed');

    assert.equal(workerBalAfter - workerBalBefore, workerAward);
    assert.equal(creatorBalAfter - creatorBalBefore, escrowBefore - workerAward);

    const taskAccount: any = await program.account.task.fetch(taskPda);
    assert.ok(taskAccount.disputeStatus.resolved, 'task dispute status should be resolved');
    assert.equal(taskAccount.workerAwardLamports.toNumber(), workerAward);
  });

  it('worker can raise a dispute; arbiter can resolve with full refund to creator', async () => {
    const creator = Keypair.generate();
    const worker = Keypair.generate();

    await airdrop(creator, 2);
    await airdrop(worker, 1);

    const [graphPda] = deriveGraphPda(authority.publicKey);

    const taskId = new anchor.BN(2002);
    const [taskPda] = deriveTaskPda(graphPda, taskId);

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
      .fundTask(new anchor.BN(700_000))
      .accounts({
        task: taskPda,
        escrow: escrowPda,
        funder: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const [receiptPda] = deriveReceiptPda(taskPda, worker.publicKey);
    const workHash = Array.from(Buffer.alloc(32, 9));

    await program.methods
      .submitReceipt({ workHash, uri: 'ipfs://receipt-2' })
      .accounts({
        task: taskPda,
        receipt: receiptPda,
        agent: worker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([worker])
      .rpc();

    await program.methods
      .disputeBounty()
      .accounts({ task: taskPda, disputer: worker.publicKey })
      .signers([worker])
      .rpc();

    const escrowBefore = await provider.connection.getBalance(escrowPda, 'confirmed');
    const workerBalBefore = await provider.connection.getBalance(worker.publicKey, 'confirmed');
    const creatorBalBefore = await provider.connection.getBalance(creator.publicKey, 'confirmed');

    await program.methods
      .resolveDispute(new anchor.BN(0))
      .accounts({
        graph: graphPda,
        authority: authority.publicKey,
        task: taskPda,
        escrow: escrowPda,
        creator: creator.publicKey,
        worker: worker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const workerBalAfter = await provider.connection.getBalance(worker.publicKey, 'confirmed');
    const creatorBalAfter = await provider.connection.getBalance(creator.publicKey, 'confirmed');

    assert.equal(workerBalAfter - workerBalBefore, 0);
    assert.equal(creatorBalAfter - creatorBalBefore, escrowBefore);

    const taskAccount: any = await program.account.task.fetch(taskPda);
    assert.ok(taskAccount.disputeStatus.resolved, 'task dispute status should be resolved');
    assert.equal(taskAccount.workerAwardLamports.toNumber(), 0);
  });
});
