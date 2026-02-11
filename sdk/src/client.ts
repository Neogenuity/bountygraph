import * as anchor from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { BOUNTYGRAPH_PROGRAM_ID } from "./programId.ts";
import { BOUNTYGRAPH_IDL } from "./idl/bountygraph.ts";
import {
  findDisputePda,
  findEscrowPda,
  findGraphPda,
  findReceiptPda,
  findTaskPda,
} from "./pdas.ts";

export type BountyGraphProgram = any;

export type InitializeGraphArgs = {
  maxDependenciesPerTask: number;
};

export type CreateTaskArgs = {
  taskId: bigint | number;
  rewardLamports: bigint | number;
  dependencies: Array<bigint | number>;
};

export type SubmitReceiptArgs = {
  workHash: Uint8Array; // 32 bytes
  uri: string;
};

export type DisputeTaskArgs = {
  reason: string;
};

export type ResolveDisputeArgs = {
  creatorPct: number;
  workerPct: number;
};

function u64(x: bigint | number): any {
  if (typeof x === "number") {
    if (!Number.isSafeInteger(x) || x < 0) throw new Error(`Invalid u64 number: ${x}`);
    return new anchor.BN(x);
  }
  if (x < 0n) throw new Error(`Invalid u64 bigint: ${x.toString()}`);
  return new anchor.BN(x.toString());
}

function normalizeDeps(deps: Array<bigint | number>): anchor.BN[] {
  return deps.map((d) => u64(d));
}

function asWorkHash32(workHash: Uint8Array): number[] {
  if (workHash.length !== 32) throw new Error(`workHash must be 32 bytes; got ${workHash.length}`);
  return Array.from(workHash);
}

export function createBountyGraphProgram(
  provider: any,
  programId: any = BOUNTYGRAPH_PROGRAM_ID
): any {
  return new (anchor as any).Program(BOUNTYGRAPH_IDL as any, programId, provider);
}

export class BountyGraphClient {
  readonly program: any;
  readonly programId: any;

  constructor(program: anchor.Program) {
    this.program = program;
    this.programId = program.programId;
  }

  static fromProvider(
    provider: any,
    programId: any = BOUNTYGRAPH_PROGRAM_ID
  ) {
    return new BountyGraphClient(createBountyGraphProgram(provider, programId));
  }

  pdas = {
    graph: (authority: any) => findGraphPda(authority, this.programId),
    task: (graph: any, taskId: bigint | number) => findTaskPda(graph, taskId, this.programId),
    escrow: (task: any) => findEscrowPda(task, this.programId),
    receipt: (task: any, agent: any) => findReceiptPda(task, agent, this.programId),
    dispute: (task: any, initiator: any) => findDisputePda(task, initiator, this.programId),
  };

  async initializeGraph(authority: any, args: InitializeGraphArgs): Promise<string> {
    const [graph] = this.pdas.graph(authority);
    return this.program.methods
      .initializeGraph({ maxDependenciesPerTask: args.maxDependenciesPerTask })
      .accounts({
        graph,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async createTask(
    authority: any,
    creator: any,
    args: CreateTaskArgs
  ): Promise<{ task: any; signature: string }> {
    const [graph] = this.pdas.graph(authority);
    const [task] = this.pdas.task(graph, args.taskId);

    const deps = normalizeDeps(args.dependencies);

    const signature = await this.program.methods
      .createTask({
        taskId: u64(args.taskId),
        rewardLamports: u64(args.rewardLamports),
        dependencies: deps,
      })
      .accounts({
        graph,
        authority,
        creator,
        task,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { task, signature };
  }

  async fundTask(
    task: any,
    funder: any,
    lamports: bigint | number
  ): Promise<{ escrow: any; signature: string }> {
    const [escrow] = this.pdas.escrow(task);

    const signature = await this.program.methods
      .fundTask(u64(lamports))
      .accounts({
        task,
        escrow,
        funder,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { escrow, signature };
  }

  async submitReceipt(
    task: any,
    agent: any,
    args: SubmitReceiptArgs,
    dependencyTasks: any[]
  ): Promise<{ receipt: any; signature: string }> {
    const [receipt] = this.pdas.receipt(task, agent);

    const signature = await this.program.methods
      .submitReceipt({
        workHash: asWorkHash32(args.workHash),
        uri: args.uri,
      })
      .accounts({
        task,
        receipt,
        agent,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(dependencyTasks.map((pk) => ({ pubkey: pk, isSigner: false, isWritable: false })))
      .rpc();

    return { receipt, signature };
  }

  async claimReward(task: any, agent: any): Promise<string> {
    const [escrow] = this.pdas.escrow(task);
    return this.program.methods
      .claimReward()
      .accounts({
        task,
        escrow,
        agent,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async disputeTask(task: any, initiator: any, args: DisputeTaskArgs) {
    const [dispute] = this.pdas.dispute(task, initiator);
    const signature = await this.program.methods
      .disputeTask({ reason: args.reason })
      .accounts({
        task,
        dispute,
        initiator,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { dispute, signature };
  }

  async resolveDispute(
    authority: any,
    task: any,
    dispute: any,
    creator: any,
    worker: any,
    args: ResolveDisputeArgs
  ) {
    const [graph] = this.pdas.graph(authority);
    const [escrow] = this.pdas.escrow(task);
    const signature = await this.program.methods
      .resolveDispute({ creatorPct: args.creatorPct, workerPct: args.workerPct })
      .accounts({
        graph,
        authority,
        task,
        dispute,
        escrow,
        creator,
        worker,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { escrow, signature };
  }
}
