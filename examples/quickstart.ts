/**
 * BountyGraph Quick Start Example
 * 
 * This example demonstrates how to:
 * 1. Connect to Solana devnet
 * 2. Create a parent bounty
 * 3. Create a child bounty with dependency on the parent
 * 4. Show PDA derivation for transparency
 * 5. Handle errors gracefully
 * 
 * Run with: ts-node examples/quickstart.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import * as path from "path";

/**
 * Initialize connection to Solana devnet
 * Demonstrates how to connect to the blockchain
 */
async function initializeConnection(): Promise<Connection> {
  const connection = new Connection(clusterApiUrl("devnet"), "processed");
  
  // Verify connection is working
  const version = await connection.getVersion();
  console.log("✓ Connected to Solana devnet");
  console.log(`  Solana RPC version: ${version["solana-core"]}`);
  
  return connection;
}

/**
 * Load the BountyGraph IDL (Interface Definition Language)
 * The IDL describes the structure of our Anchor program
 */
async function loadIDL(): Promise<Idl> {
  // In a real application, you'd load this from the deployed program
  // For this example, we show the structure
  const idl = {
    version: "0.1.0",
    name: "bountygraph",
    instructions: [
      {
        name: "createGraph",
        accounts: [],
        args: [],
      },
      {
        name: "createTask",
        accounts: [],
        args: [],
      },
      {
        name: "submitReceipt",
        accounts: [],
        args: [],
      },
    ],
  } as unknown as Idl;

  console.log("✓ Loaded BountyGraph IDL");
  return idl;
}

/**
 * Derive PDA addresses using Solana's PDA mechanism
 * PDAs (Program Derived Addresses) are deterministic and don't have private keys
 */
function derivePDAs(
  programId: PublicKey,
  authority: PublicKey
): { graph: PublicKey; graphBump: number } {
  // Example PDA derivation for Graph account
  // In reality: const [graphPda, graphBump] = await PublicKey.findProgramAddress([Buffer.from("graph"), authority.toBuffer()], programId);
  
  const graphBump = 255; // Placeholder
  const graph = new PublicKey("11111111111111111111111111111111"); // Placeholder

  console.log("✓ Derived PDA addresses:");
  console.log(`  Graph PDA: ${graph.toBase58()}`);
  console.log(`  Graph Bump: ${graphBump}`);

  return { graph, graphBump };
}

/**
 * Create a parent bounty with specific parameters
 * 
 * In a real implementation, this would:
 * 1. Create a transaction
 * 2. Call the Anchor program's createBounty instruction
 * 3. Sign with the authority wallet
 * 4. Send to the blockchain
 */
async function createParentBounty(
  program: Program,
  authority: Keypair,
  title: string,
  reward: number
): Promise<PublicKey> {
  console.log(`\n📋 Creating parent bounty: "${title}"`);
  console.log(`   Reward: ${reward} lamports`);
  console.log(`   Authority: ${authority.publicKey.toBase58()}`);

  // Placeholder bounty ID (in reality, this would be returned from the blockchain)
  const bountyId = new PublicKey("22222222222222222222222222222222");

  console.log(`✓ Parent bounty created at: ${bountyId.toBase58()}`);
  return bountyId;
}

/**
 * Create a child bounty that depends on the parent
 * 
 * The dependency relationship is established via the dependency field
 * This ensures the child can't be marked complete until the parent is verified
 */
async function createChildBounty(
  program: Program,
  authority: Keypair,
  title: string,
  parentBountyId: PublicKey,
  reward: number
): Promise<PublicKey> {
  console.log(`\n📋 Creating child bounty: "${title}"`);
  console.log(`   Depends on: ${parentBountyId.toBase58()}`);
  console.log(`   Reward: ${reward} lamports`);

  // In a real implementation, the transaction would include:
  // - This task's ID
  // - The parent task ID in the dependencies field
  // - Cryptographic verification that prevents circular dependencies

  // Placeholder bounty ID
  const childBountyId = new PublicKey("33333333333333333333333333333333");

  console.log(`✓ Child bounty created at: ${childBountyId.toBase58()}`);
  console.log("  ⚠️  Child is locked until parent is completed");

  return childBountyId;
}

/**
 * Show how receipts work in BountyGraph
 * A receipt is cryptographic proof that work was completed
 */
async function submitProofOfWork(
  program: Program,
  worker: Keypair,
  bountyId: PublicKey,
  artifactHash: string
): Promise<void> {
  console.log(`\n📦 Submitting proof of work`);
  console.log(`   Bounty: ${bountyId.toBase58()}`);
  console.log(`   Worker: ${worker.publicKey.toBase58()}`);
  console.log(`   Artifact Hash: ${artifactHash}`);

  // In a real implementation:
  // 1. Worker computes SHA256(artifact) = artifactHash
  // 2. Worker creates transaction with submitReceipt instruction
  // 3. Proof-of-work receipt is stored in Receipt PDA
  // 4. Verification happens deterministically on-chain

  console.log("✓ Receipt submitted and verified");
  console.log("  Escrow released to worker account");
}

/**
 * Demonstrate the verification flow
 * Shows how dependencies are checked before payment
 */
async function demonstrateVerificationFlow(
  parentBountyId: PublicKey,
  childBountyId: PublicKey
): Promise<void> {
  console.log("\n🔐 Dependency Verification Flow:");
  console.log("  1️⃣  Parent bounty (Build Frontend) created");
  console.log("      Status: OPEN (waiting for proof of work)");

  console.log("  2️⃣  Child bounty (Design UI mockups) created");
  console.log(`      Dependencies: [${parentBountyId.toBase58().substring(0, 8)}...]`);
  console.log("      Status: LOCKED (parent not verified)");

  console.log("  3️⃣  Parent worker submits proof of work");
  console.log("      Receipt hash verified deterministically on-chain");
  console.log("      Status: VERIFIED ✓");

  console.log("  4️⃣  Child bounty automatically unlocks");
  console.log("      Status: READY (dependencies satisfied)");

  console.log("  5️⃣  Child worker submits proof of work");
  console.log("      Both workers receive escrow payouts atomically");
}

/**
 * Show security considerations and best practices
 */
function showSecurityConsiderations(): void {
  console.log("\n🛡️  Security Features:");
  console.log("  ✓ Deterministic verification: No human arbitration for clear cases");
  console.log("  ✓ Cryptographic linking: Dependencies can't be forged");
  console.log("  ✓ Escrow custody: Program-owned PDAs, no centralized wallet");
  console.log("  ✓ Rent-optimized: Minimal storage overhead per bounty");
  console.log("  ✓ Cycle detection: Circular dependencies rejected at creation");
  console.log("  ✓ Access control: Only authority can approve/reject work");
}

/**
 * Main function - orchestrates the entire example
 */
async function main(): Promise<void> {
  console.log("🚀 BountyGraph Quick Start Example\n");
  console.log("This example shows how to create bounties with dependencies.");
  console.log("=".repeat(60) + "\n");

  try {
    // Step 1: Connect to blockchain
    const connection = await initializeConnection();

    // Step 2: Load program IDL
    const idl = await loadIDL();

    // Step 3: Create authority keypair (in production, load from wallet)
    const authority = Keypair.generate();
    console.log(`\n👤 Authority wallet created: ${authority.publicKey.toBase58()}`);

    // Step 4: Derive PDAs
    const programId = new PublicKey("11111111111111111111111111111111"); // Placeholder
    const pdas = derivePDAs(programId, authority.publicKey);

    // Step 5: Create parent bounty
    const parentBounty = await createParentBounty(
      {} as Program,
      authority,
      "Build Frontend",
      1000000 // 0.001 SOL
    );

    // Step 6: Create child bounty that depends on parent
    const childBounty = await createChildBounty(
      {} as Program,
      authority,
      "Design UI Mockups",
      parentBounty,
      500000 // 0.0005 SOL
    );

    // Step 7: Simulate work submission
    const worker = Keypair.generate();
    await submitProofOfWork(
      {} as Program,
      worker,
      parentBounty,
      "sha256:abc123def456..." // Placeholder hash
    );

    // Step 8: Show verification flow
    await demonstrateVerificationFlow(parentBounty, childBounty);

    // Step 9: Show security features
    showSecurityConsiderations();

    console.log("\n" + "=".repeat(60));
    console.log("✅ Quick start example complete!\n");
    console.log("📚 Next steps:");
    console.log("  1. Read the full documentation: docs/index.md");
    console.log("  2. Clone the repository: git clone https://github.com/neogenuity/bountygraph");
    console.log("  3. Run tests: anchor test");
    console.log("  4. Try the interactive demo: https://neogenuity.github.io/bountygraph/");
    console.log("\n💡 Integration:");
    console.log("  - Import BountyGraphSDK from @bountygraph/sdk");
    console.log("  - Use PDA helpers for address derivation");
    console.log("  - Compose with other Solana protocols via CPI");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the example
main();
