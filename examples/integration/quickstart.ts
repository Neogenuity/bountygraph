/**
 * BountyGraph Integration Quickstart
 *
 * This example demonstrates the basic flow for integrating BountyGraph:
 * 1. Initialize connection and program
 * 2. Create a bounty
 * 3. Submit work
 * 4. Release funds
 * 5. Query state
 *
 * To run this with actual transactions:
 * npm install @solana/web3.js @project-serum/anchor @bountygraph/sdk
 *
 * Then update the configuration below with real values.
 */

import {
  Connection,
  PublicKey,
  clusterApiUrl,
  Keypair,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

// These would be imported from actual packages in a real integration
// import { Program, AnchorProvider, IDL } from '@project-serum/anchor';
// import { IDL as BOUNTYGRAPH_IDL } from '@bountygraph/sdk';

/**
 * Step 1: Initialize Connection and Program
 *
 * Sets up the Solana connection and BountyGraph program reference.
 */
async function initializeProgram() {
  console.log('Step 1: Initializing connection...');

  // Connect to Solana devnet (or mainnet-beta for production)
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  console.log(
    'Connected to',
    clusterApiUrl('devnet'),
    'with commitment: confirmed'
  );

  // In a real browser environment, you would use window.solana (Phantom)
  // For testing, use a Keypair or connect to a wallet
  // const wallet = window.solana; // Browser environment
  // await wallet.connect();

  // For development, create a test keypair
  const wallet = Keypair.generate();
  console.log('Wallet address:', wallet.publicKey.toString());

  // Create an AnchorProvider (would use real wallet in production)
  // const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // Load BountyGraph IDL and create program instance
  // const programId = new PublicKey('YOUR_BOUNTYGRAPH_PROGRAM_ID');
  // const program = new Program(BOUNTYGRAPH_IDL, programId, provider);

  console.log('✓ Connection initialized\n');

  return {
    connection,
    wallet,
    // program, // Would be returned in real code
  };
}

/**
 * Step 2: Create a Bounty
 *
 * Demonstrates how to create a new bounty with PDA derivation.
 */
function createBountyExample() {
  console.log('Step 2: Creating a bounty...');

  // Unique identifier for this bounty
  const bountyId = Keypair.generate().publicKey;
  console.log('Generated bounty ID:', bountyId.toString());

  // Derive the PDA where bounty state will be stored
  // In real code:
  // const [bountyPda, bumpSeed] = await PublicKey.findProgramAddress(
  //   [Buffer.from('bounty'), bountyId.toBuffer()],
  //   programId
  // );

  const bountyDetails = {
    id: bountyId.toString(),
    title: 'Implement payment processor integration',
    description:
      'Add Stripe/PayPal integration to our platform. Should include webhook handling, error management, and test coverage.',
    rewardAmount: 2_000_000_000, // 2 SOL in lamports
    deadline: Math.floor(Date.now() / 1000) + 7 * 86400, // 7 days from now
    tags: ['backend', 'payments', 'typescript'],
  };

  console.log('Bounty details:', bountyDetails);
  console.log('Reward: 2 SOL');
  console.log('Deadline: 7 days from now\n');

  // In a real integration:
  // const tx = await program.methods
  //   .createBounty({
  //     bountyId,
  //     title: bountyDetails.title,
  //     description: bountyDetails.description,
  //     rewardAmount: new BN(bountyDetails.rewardAmount),
  //     deadline: new BN(bountyDetails.deadline),
  //   })
  //   .accounts({
  //     bounty: bountyPda,
  //     creator: wallet.publicKey,
  //     escrow: escrowTokenAccount,
  //     systemProgram: SystemProgram.programId,
  //   })
  //   .rpc();

  console.log('✓ Bounty created (would be submitted in real flow)\n');

  return bountyDetails;
}

/**
 * Step 3: Submit Work to a Bounty
 *
 * Shows how a solver submits work for a bounty.
 */
function submitWorkExample() {
  console.log('Step 3: Submitting work...');

  const workSubmission = {
    workId: Keypair.generate().publicKey.toString(),
    submittedBy: Keypair.generate().publicKey.toString(),
    description:
      'Implemented Stripe integration with full webhook support. Added comprehensive error handling and unit tests.',
    proofUrl: 'https://github.com/example/pr/789',
    metadata: {
      commitHash: 'abc123def456789',
      testsPassed: true,
      testCoverage: 95,
      linesOfCode: 450,
      filesChanged: 8,
    },
  };

  console.log('Work submission:', {
    ...workSubmission,
    metadata: '(test coverage: 95%, 450 LOC)',
  });

  // In a real integration:
  // const [receiptPda] = await PublicKey.findProgramAddress(
  //   [Buffer.from('receipt'), bountyPda.toBuffer(), workId.toBuffer()],
  //   programId
  // );
  //
  // const tx = await program.methods
  //   .submitWork({
  //     workId,
  //     description: workSubmission.description,
  //     proofUrl: workSubmission.proofUrl,
  //     metadata: workSubmission.metadata,
  //   })
  //   .accounts({
  //     bounty: bountyPda,
  //     receipt: receiptPda,
  //     submitter: wallet.publicKey,
  //     systemProgram: SystemProgram.programId,
  //   })
  //   .rpc();

  console.log('✓ Work submitted (would be confirmed in real flow)\n');

  return workSubmission;
}

/**
 * Step 4: Release Funds (After Acceptance)
 *
 * Demonstrates fund release after work is accepted.
 */
function releaseFundsExample() {
  console.log('Step 4: Releasing funds...');

  const releaseDetails = {
    solver: Keypair.generate().publicKey.toString(),
    amount: 2_000_000_000, // 2 SOL
    timestamp: new Date().toISOString(),
    status: 'pending_confirmation',
  };

  console.log('Fund release transaction:', {
    recipient: releaseDetails.solver.substring(0, 20) + '...',
    amount: '2 SOL',
    status: 'Would be submitted to network',
  });

  // In a real integration:
  // const tx = await program.methods
  //   .releaseEscrow({
  //     receiptId: workId,
  //   })
  //   .accounts({
  //     bounty: bountyPda,
  //     receipt: receiptPda,
  //     creator: wallet.publicKey,
  //     solver: solverWalletAddress,
  //     escrow: escrowTokenAccount,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //   })
  //   .rpc();
  //
  // // Wait for confirmation
  // const confirmation = await connection.confirmTransaction(tx, 'confirmed');

  console.log('✓ Funds released (would be confirmed in real flow)\n');

  return releaseDetails;
}

/**
 * Step 5: Query Bounty State
 *
 * Shows how to fetch and display bounty information from the blockchain.
 */
async function queryBountyStateExample() {
  console.log('Step 5: Querying bounty state...');

  const queryResult = {
    bounty: {
      id: Keypair.generate().publicKey.toString(),
      title: 'Implement payment processor integration',
      creator: Keypair.generate().publicKey.toString(),
      status: 'in_progress',
      escrowAmount: 2_000_000_000,
      submissions: 3,
      deadline: new Date(Date.now() + 5 * 86400).toISOString(),
    },
    submissions: [
      {
        id: Keypair.generate().publicKey.toString(),
        submitter: Keypair.generate().publicKey.toString(),
        status: 'accepted',
        submittedAt: new Date(Date.now() - 86400).toISOString(),
      },
      {
        id: Keypair.generate().publicKey.toString(),
        submitter: Keypair.generate().publicKey.toString(),
        status: 'pending_review',
        submittedAt: new Date(Date.now() - 3600).toISOString(),
      },
      {
        id: Keypair.generate().publicKey.toString(),
        submitter: Keypair.generate().publicKey.toString(),
        status: 'rejected',
        submittedAt: new Date(Date.now() - 1800).toISOString(),
      },
    ],
  };

  console.log('Bounty state:', {
    title: queryResult.bounty.title,
    status: queryResult.bounty.status,
    submissions: queryResult.submissions.length,
    daysUntilDeadline: 5,
  });

  console.log('\nSubmissions:', {
    accepted: queryResult.submissions.filter(s => s.status === 'accepted')
      .length,
    pending: queryResult.submissions.filter(s => s.status === 'pending_review')
      .length,
    rejected: queryResult.submissions.filter(s => s.status === 'rejected')
      .length,
  });

  console.log('✓ Bounty state queried\n');

  return queryResult;
}

/**
 * Error Handling Pattern
 *
 * Shows common error cases and how to handle them.
 */
function errorHandlingExample() {
  console.log('Error Handling Patterns:\n');

  // Pattern 1: Transaction failure
  const txErrorExample = `
  try {
    const tx = await program.methods.createBounty(...).rpc();
    const confirmation = await connection.confirmTransaction(tx, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return { success: false, error: confirmation.value.err };
    }
  } catch (error) {
    if (error.code === -32603) {
      console.error('RPC error - check endpoint');
    } else if (error.message.includes('Insufficient funds')) {
      console.error('Wallet has insufficient SOL for rent + tx fee');
    }
    throw error;
  }
  `;

  // Pattern 2: Account not found
  const accountErrorExample = `
  try {
    const bounty = await program.account.bounty.fetch(bountyPda);
    console.log('Bounty found:', bounty);
  } catch (error) {
    if (error.message.includes('Account does not exist')) {
      console.error('Bounty not yet created or wrong address');
      return null;
    }
    throw error;
  }
  `;

  // Pattern 3: Invalid PDA
  const pdaErrorExample = `
  // Always verify PDA derivation matches BountyGraph's seeds
  const expectedSeeds = [Buffer.from('bounty'), bountyId.toBuffer()];
  const [derivedPda, bump] = await PublicKey.findProgramAddress(
    expectedSeeds,
    programId
  );
  
  // Verify this matches what you expect
  if (!derivedPda.equals(bountyPda)) {
    throw new Error('PDA mismatch - check seed derivation');
  }
  `;

  console.log('1. Transaction Failures:');
  console.log(
    '   - Always wait for confirmation with confirmTransaction()'
  );
  console.log('   - Check error.value.err for on-chain failures');
  console.log('   - Catch network errors separately\n');

  console.log('2. Account Not Found:');
  console.log(
    '   - Verify account was created and rent was paid (0.0022 SOL)'
  );
  console.log('   - Use correct PDA seeds for lookup\n');

  console.log('3. PDA Derivation:');
  console.log('   - Seeds MUST match: [Buffer.from("bounty"), bountyId]');
  console.log('   - Use findProgramAddress, never hardcode\n');

  console.log('4. Permission Errors:');
  console.log('   - Only bounty creator can release funds');
  console.log(
    '   - Solver must match account in release instruction\n'
  );
}

/**
 * Main Integration Flow
 *
 * Orchestrates all steps in sequence.
 */
async function runIntegration() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('BountyGraph Integration Quickstart');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Step 1: Initialize
    const { connection, wallet } = await initializeProgram();

    // Step 2: Create bounty
    const bounty = createBountyExample();

    // Step 3: Submit work
    const work = submitWorkExample();

    // Step 4: Release funds (after acceptance)
    const release = releaseFundsExample();

    // Step 5: Query state
    const state = await queryBountyStateExample();

    // Show error patterns
    errorHandlingExample();

    console.log('═══════════════════════════════════════════════════════');
    console.log('Integration Flow Complete!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('Next Steps:');
    console.log('1. Replace example functions with real program.methods calls');
    console.log('2. Set SOLANA_NETWORK env var to devnet or mainnet-beta');
    console.log('3. Fund wallet with devnet SOL: solana airdrop 10');
    console.log('4. Run: npx ts-node quickstart.ts');
    console.log('\nFor full integration guide, see README.md');
  } catch (error) {
    console.error('Integration error:', error);
    process.exit(1);
  }
}

// Run the integration flow
runIntegration().catch(console.error);
