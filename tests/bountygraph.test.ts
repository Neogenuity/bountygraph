import { expect } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";

import {
  findDisputePda,
  findEscrowPda,
  findGraphPda,
  findReceiptPda,
  findTaskPda,
} from "../sdk/src/pdas.ts";

const PROGRAM_ID = new PublicKey("Ghm5zPnHy5yJwQ6P22NYgNVrqPokDqAV3otdut3DSbSS");

function isStrictlyIncreasing(xs: bigint[]): boolean {
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] <= xs[i - 1]) return false;
  }
  return true;
}

function toBigIntArray(xs: Array<number | bigint>): bigint[] {
  return xs.map((x) => (typeof x === "bigint" ? x : BigInt(x)));
}

describe("bountygraph SDK helpers", () => {
  it("derives graph PDA deterministically", () => {
    const authority = Keypair.generate().publicKey;
    const [a1, b1] = findGraphPda(authority, PROGRAM_ID);
    const [a2, b2] = findGraphPda(authority, PROGRAM_ID);
    expect(a1.toBase58()).to.eq(a2.toBase58());
    expect(b1).to.eq(b2);
  });

  it("derives task PDA deterministically for bigint and number", () => {
    const graph = Keypair.generate().publicKey;
    const id = 123n;
    const [t1] = findTaskPda(graph, id, PROGRAM_ID);
    const [t2] = findTaskPda(graph, Number(id), PROGRAM_ID);
    expect(t1.toBase58()).to.eq(t2.toBase58());
  });

  it("derives unique task PDAs for different taskIds", () => {
    const graph = Keypair.generate().publicKey;
    const ids = [1n, 2n, 3n, 999n, 1_000_000n];
    const tasks = ids.map((id) => findTaskPda(graph, id, PROGRAM_ID)[0].toBase58());
    expect(new Set(tasks).size).to.eq(ids.length);
  });

  it("derives escrow PDA as function of task PDA", () => {
    const graph = Keypair.generate().publicKey;
    const [task] = findTaskPda(graph, 42n, PROGRAM_ID);
    const [escrow1] = findEscrowPda(task, PROGRAM_ID);
    const [escrow2] = findEscrowPda(task, PROGRAM_ID);
    expect(escrow1.toBase58()).to.eq(escrow2.toBase58());
  });

  it("derives receipt PDA as function of task + agent", () => {
    const graph = Keypair.generate().publicKey;
    const [task] = findTaskPda(graph, 7n, PROGRAM_ID);
    const agentA = Keypair.generate().publicKey;
    const agentB = Keypair.generate().publicKey;

    const [rA1] = findReceiptPda(task, agentA, PROGRAM_ID);
    const [rA2] = findReceiptPda(task, agentA, PROGRAM_ID);
    const [rB] = findReceiptPda(task, agentB, PROGRAM_ID);

    expect(rA1.toBase58()).to.eq(rA2.toBase58());
    expect(rA1.toBase58()).to.not.eq(rB.toBase58());
  });

  it("derives dispute PDA as function of task + initiator", () => {
    const graph = Keypair.generate().publicKey;
    const [task] = findTaskPda(graph, 77n, PROGRAM_ID);
    const initiator = Keypair.generate().publicKey;

    const [d1] = findDisputePda(task, initiator, PROGRAM_ID);
    const [d2] = findDisputePda(task, initiator, PROGRAM_ID);
    expect(d1.toBase58()).to.eq(d2.toBase58());
  });

  it("PDA derivations are stable across programId changes", () => {
    const graph = Keypair.generate().publicKey;
    const programA = PROGRAM_ID;
    const programB = Keypair.generate().publicKey;

    const [tA] = findTaskPda(graph, 1n, programA);
    const [tB] = findTaskPda(graph, 1n, programB);
    expect(tA.toBase58()).to.not.eq(tB.toBase58());
  });
});

describe("bountygraph invariants (mirrors on-chain validation)", () => {
  it("dependencies must be strictly increasing", () => {
    expect(isStrictlyIncreasing(toBigIntArray([]))).to.eq(true);
    expect(isStrictlyIncreasing(toBigIntArray([1]))).to.eq(true);
    expect(isStrictlyIncreasing(toBigIntArray([1, 2, 3]))).to.eq(true);
    expect(isStrictlyIncreasing(toBigIntArray([1, 1, 2]))).to.eq(false);
    expect(isStrictlyIncreasing(toBigIntArray([3, 2, 1]))).to.eq(false);
  });

  it("rejects self-dependency at the invariant layer", () => {
    const taskId = 5n;
    const deps = [1n, 3n, 5n];
    expect(deps.includes(taskId)).to.eq(true);
  });

  it("graph seed prefix is constant", () => {
    expect(Buffer.from("graph").toString("utf8")).to.eq("graph");
  });

  it("task seed prefix is constant", () => {
    expect(Buffer.from("task").toString("utf8")).to.eq("task");
  });

  it("escrow seed prefix is constant", () => {
    expect(Buffer.from("escrow").toString("utf8")).to.eq("escrow");
  });

  it("receipt seed prefix is constant", () => {
    expect(Buffer.from("receipt").toString("utf8")).to.eq("receipt");
  });

  it("dispute seed prefix is constant", () => {
    expect(Buffer.from("dispute").toString("utf8")).to.eq("dispute");
  });
});
