import { PublicKey } from "@solana/web3.js";
import { BOUNTYGRAPH_PROGRAM_ID } from "./programId.ts";

/**
 * Any object that can be losslessly converted into the 32-byte public key bytes used for PDA seeds.
 *
 * Examples:
 * - `PublicKey`
 * - `Keypair.publicKey`
 * - Anchor "web3.PublicKey" equivalents
 */
export type PubkeyLike = { toBuffer(): Buffer };

/**
 * PDA seed prefixes.
 *
 * Keeping these centralized avoids accidental prefix drift between:
 * - on-chain seed derivations (Anchor program)
 * - off-chain SDK PDA derivations (this file)
 */
export const PDA_SEEDS = {
  graph: "graph",
  task: "task",
  escrow: "escrow",
  receipt: "receipt",
  dispute: "dispute",
} as const;

/**
 * Derive the Graph PDA.
 *
 * Seeds: ["graph", authority]
 *
 * Typical usage:
 * ```ts
 * const [graphPda] = findGraphPda(wallet.publicKey);
 * ```
 */
export function findGraphPda(
  authority: PubkeyLike,
  programId: PublicKey = BOUNTYGRAPH_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.graph), authority.toBuffer()],
    programId
  );
}

/**
 * Derive the Task PDA.
 *
 * Seeds: ["task", graph, taskIdLE]
 * - taskIdLE is a u64 encoded little-endian.
 *
 * Rationale:
 * - using a fixed-width u64 keeps PDA derivation deterministic and sortable
 * - little-endian matches Solana/Anchor convention for numeric seeds
 *
 * Typical usage:
 * ```ts
 * const [taskPda] = findTaskPda(graphPda, 42);
 * ```
 */
export function findTaskPda(
  graph: PubkeyLike,
  taskId: bigint | number,
  programId: PublicKey = BOUNTYGRAPH_PROGRAM_ID
): [PublicKey, number] {
  let id: bigint;
  if (typeof taskId === "number") {
    if (!Number.isSafeInteger(taskId) || taskId < 0) {
      throw new Error(`Invalid taskId number: ${taskId}`);
    }
    id = BigInt(taskId);
  } else {
    if (taskId < 0n) throw new Error(`Invalid taskId bigint: ${taskId.toString()}`);
    id = taskId;
  }

  const le = Buffer.alloc(8);
  le.writeBigUInt64LE(id);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.task), graph.toBuffer(), le],
    programId
  );
}

/**
 * Derive the Escrow PDA.
 *
 * Seeds: ["escrow", task]
 */
export function findEscrowPda(
  task: PubkeyLike,
  programId: PublicKey = BOUNTYGRAPH_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.escrow), task.toBuffer()],
    programId
  );
}

/**
 * Derive the Receipt PDA.
 *
 * Seeds: ["receipt", task, agent]
 *
 * Why agent in the seed:
 * - makes receipts unique per (task, agent) pair
 * - prevents duplicate submissions from the same agent for the same task
 */
export function findReceiptPda(
  task: PubkeyLike,
  agent: PubkeyLike,
  programId: PublicKey = BOUNTYGRAPH_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.receipt), task.toBuffer(), agent.toBuffer()],
    programId
  );
}

/**
 * Derive the Dispute PDA.
 *
 * Seeds: ["dispute", task, initiator]
 *
 * Why initiator in the seed:
 * - allows (at most) one dispute state per initiator per task
 * - avoids a single global "dispute" account becoming a contention point
 */
export function findDisputePda(
  task: PubkeyLike,
  initiator: PubkeyLike,
  programId: PublicKey = BOUNTYGRAPH_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.dispute), task.toBuffer(), initiator.toBuffer()],
    programId
  );
}
