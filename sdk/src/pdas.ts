import { PublicKey } from "@solana/web3.js";
import { BOUNTYGRAPH_PROGRAM_ID } from "./programId";

export function findGraphPda(authority: any, programId: any = BOUNTYGRAPH_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("graph"), authority.toBuffer()],
    programId
  );
}

export function findTaskPda(
  graph: any,
  taskId: bigint | number,
  programId: any = BOUNTYGRAPH_PROGRAM_ID
) {
  const id = typeof taskId === "bigint" ? taskId : BigInt(taskId);
  const le = Buffer.alloc(8);
  le.writeBigUInt64LE(id);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("task"), graph.toBuffer(), le],
    programId
  );
}

export function findEscrowPda(task: any, programId: any = BOUNTYGRAPH_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), task.toBuffer()],
    programId
  );
}

export function findReceiptPda(
  task: any,
  agent: any,
  programId: any = BOUNTYGRAPH_PROGRAM_ID
) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), task.toBuffer(), agent.toBuffer()],
    programId
  );
}

export function findDisputePda(
  task: any,
  initiator: any,
  programId: any = BOUNTYGRAPH_PROGRAM_ID
) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dispute"), task.toBuffer(), initiator.toBuffer()],
    programId
  );
}
