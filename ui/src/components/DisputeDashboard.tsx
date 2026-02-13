import React, { useEffect, useMemo, useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";

import { BOUNTYGRAPH_PROGRAM_ID } from "../program";
import { BOUNTYGRAPH_IDL } from "../idl/bountygraph";

type UiDisputeStatus = "PENDING" | "ARBITRATING" | "RESOLVED";

type UiDispute = {
  dispute: PublicKey;
  task: PublicKey;
  creator: PublicKey;
  worker: PublicKey;
  raisedBy: PublicKey;
  reason: string;
  status: UiDisputeStatus;
  raisedAtSlot: number;
  resolvedAtSlot: number | null;
  arbiter: PublicKey | null;
  creatorPct: number | null;
  workerPct: number | null;
  signatures: string[];
  raisedAtTime: number | null;
  resolvedAtTime: number | null;
};

type ExampleDispute = {
  dispute: string;
  task: string;
  creator: string;
  worker: string;
  raisedBy: string;
  reason: string;
  status: UiDisputeStatus;
  raisedAtSlot: number;
  resolvedAtSlot: number | null;
  arbiter: string | null;
  creatorPct: number | null;
  workerPct: number | null;
  signatures: string[];
  raisedAtTime: number | null;
  resolvedAtTime: number | null;
};

function shortPk(pk: PublicKey): string {
  const s = pk.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function statusBadge(status: UiDisputeStatus): { label: string; className: string } {
  switch (status) {
    case "RESOLVED":
      return {
        label: "Resolved",
        className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      };
    case "ARBITRATING":
      return {
        label: "Arbitrating",
        className: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
      };
    default:
      return {
        label: "Pending",
        className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      };
  }
}

function formatTime(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString();
}

const EXAMPLE_DISPUTES: ExampleDispute[] = [
  {
    dispute: "11111111111111111111111111111111",
    task: "So11111111111111111111111111111111111111112",
    creator: "SysvarRent111111111111111111111111111111111",
    worker: "SysvarC1ock11111111111111111111111111111111",
    raisedBy: "SysvarC1ock11111111111111111111111111111111",
    reason: "Receipt hash mismatch vs expected artifact; requesting arbitration split.",
    status: "ARBITRATING",
    raisedAtSlot: 259001111,
    resolvedAtSlot: null,
    arbiter: "SysvarC1ock11111111111111111111111111111111",
    creatorPct: null,
    workerPct: null,
    signatures: [],
    raisedAtTime: Math.floor(Date.now() / 1000) - 60 * 60 * 5,
    resolvedAtTime: null,
  },
  {
    dispute: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    task: "Stake11111111111111111111111111111111111111",
    creator: "SysvarRent111111111111111111111111111111111",
    worker: "11111111111111111111111111111111",
    raisedBy: "11111111111111111111111111111111",
    reason: "Dependency completion proof disputed; final payout split stored on-chain.",
    status: "RESOLVED",
    raisedAtSlot: 258991000,
    resolvedAtSlot: 258995000,
    arbiter: "SysvarC1ock11111111111111111111111111111111",
    creatorPct: 30,
    workerPct: 70,
    signatures: [],
    raisedAtTime: Math.floor(Date.now() / 1000) - 60 * 60 * 30,
    resolvedAtTime: Math.floor(Date.now() / 1000) - 60 * 60 * 26,
  },
];

function exampleUiDisputes(): UiDispute[] {
  return EXAMPLE_DISPUTES.map((d) => ({
    ...d,
    dispute: new PublicKey(d.dispute),
    task: new PublicKey(d.task),
    creator: new PublicKey(d.creator),
    worker: new PublicKey(d.worker),
    raisedBy: new PublicKey(d.raisedBy),
    arbiter: d.arbiter ? new PublicKey(d.arbiter) : null,
  }));
}

export const DisputeDashboard: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<UiDispute[]>([]);
  const [usingExampleData, setUsingExampleData] = useState(false);

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!provider) {
          if (!alive) return;
          setUsingExampleData(true);
          setDisputes(exampleUiDisputes());
          return;
        }

        const program = new Program(
          BOUNTYGRAPH_IDL as unknown as Idl,
          BOUNTYGRAPH_PROGRAM_ID,
          provider
        );

        const onchain = await program.account.dispute.all();

        const decoded: UiDispute[] = [];
        for (const { publicKey, account } of onchain as Array<{ publicKey: PublicKey; account: any }>) {
          const rawStatus = account.status as { none?: {}; raised?: {}; resolved?: {} };
          const arbiterPk = (account.arbiter as PublicKey | null) ?? null;

          const status: UiDisputeStatus = rawStatus?.resolved
            ? "RESOLVED"
            : arbiterPk
              ? "ARBITRATING"
              : "PENDING";

          const raisedAtSlot = Number(account.raisedAtSlot);
          const resolvedAtSlotOpt = account.resolvedAtSlot as unknown;
          const resolvedAtSlot =
            resolvedAtSlotOpt && typeof resolvedAtSlotOpt === "object" && "toNumber" in (resolvedAtSlotOpt as any)
              ? Number((resolvedAtSlotOpt as any).toNumber())
              : (resolvedAtSlotOpt as number | null);

          const [sigs, raisedTime, resolvedTime] = await Promise.all([
            connection
              .getSignaturesForAddress(publicKey, { limit: 5 }, "confirmed")
              .then((xs: Array<{ signature: string }>) => xs.map((x) => x.signature)),
            connection.getBlockTime(raisedAtSlot).catch(() => null),
            resolvedAtSlot ? connection.getBlockTime(resolvedAtSlot).catch(() => null) : Promise.resolve(null),
          ]);

          decoded.push({
            dispute: publicKey,
            task: account.task as PublicKey,
            creator: account.creator as PublicKey,
            worker: account.worker as PublicKey,
            raisedBy: account.raisedBy as PublicKey,
            reason: account.reason as string,
            status,
            raisedAtSlot,
            resolvedAtSlot,
            arbiter: arbiterPk,
            creatorPct: (account.creatorPct ?? null) as number | null,
            workerPct: (account.workerPct ?? null) as number | null,
            signatures: sigs,
            raisedAtTime: raisedTime,
            resolvedAtTime: resolvedTime,
          });
        }

        decoded.sort((a, b) => b.raisedAtSlot - a.raisedAtSlot);

        if (!alive) return;

        if (decoded.length === 0) {
          setUsingExampleData(true);
          setDisputes(exampleUiDisputes());
        } else {
          setUsingExampleData(false);
          setDisputes(decoded);
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setUsingExampleData(true);
        setDisputes(exampleUiDisputes());
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [connection, provider]);

  const headerSubtext = useMemo(() => {
    if (loading) return "Loading on-chain dispute accounts…";
    if (error) return "Showing example data (RPC/IDL unavailable).";
    if (usingExampleData) return "Showing example data (no live disputes found).";
    return "Live on-chain dispute accounts decoded from program state.";
  }, [error, loading, usingExampleData]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <div className="bg-slate-700/40 rounded-xl border border-slate-600 overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Dispute Resolution Dashboard</h2>
            <p className="text-slate-300 text-sm mt-1">{headerSubtext}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-300 border border-slate-500/60 rounded-lg px-3 py-2">
              <div className="font-semibold text-white">Program</div>
              <div className="mt-0.5">{shortPk(BOUNTYGRAPH_PROGRAM_ID)}</div>
            </div>

            <button
              type="button"
              className="text-sm px-4 py-2 rounded-lg border border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/10 transition"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="px-6 pb-4">
            <div className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="font-semibold">RPC/Decode warning</div>
              <div className="mt-1 text-amber-100/90 break-words">{error}</div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {disputes.map((d) => {
              const badge = statusBadge(d.status);
              const proofs = d.signatures.slice(0, 2);

              return (
                <div
                  key={d.dispute.toBase58()}
                  className="bg-slate-900/30 rounded-xl border border-slate-600 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-white font-semibold">Task {shortPk(d.task)}</div>
                      <div className="text-xs text-slate-400 mt-1">Dispute {shortPk(d.dispute)}</div>
                    </div>
                    <div className={`text-xs border rounded-full px-3 py-1 ${badge.className}`}>{badge.label}</div>
                  </div>

                  <div className="mt-4 text-sm text-slate-200/90">
                    <div className="line-clamp-3">{d.reason}</div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-800/30 border border-slate-600 rounded-lg p-3">
                      <div className="text-slate-400">Creator</div>
                      <div className="text-slate-100 mt-1">{shortPk(d.creator)}</div>
                    </div>
                    <div className="bg-slate-800/30 border border-slate-600 rounded-lg p-3">
                      <div className="text-slate-400">Worker</div>
                      <div className="text-slate-100 mt-1">{shortPk(d.worker)}</div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-600 pt-4">
                    <div className="text-xs text-slate-300 font-semibold">Resolution timeline</div>
                    <div className="mt-2 space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Raised</span>
                        <span className="text-slate-100">
                          slot {d.raisedAtSlot} · {formatTime(d.raisedAtTime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Arbiter</span>
                        <span className="text-slate-100">{d.arbiter ? shortPk(d.arbiter) : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Resolved</span>
                        <span className="text-slate-100">
                          {d.resolvedAtSlot
                            ? `slot ${d.resolvedAtSlot} · ${formatTime(d.resolvedAtTime)}`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Split</span>
                        <span className="text-slate-100">
                          {d.creatorPct != null && d.workerPct != null ? `${d.creatorPct}/${d.workerPct}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-600 pt-4">
                    <div className="text-xs text-slate-300 font-semibold">On-chain proofs</div>
                    <div className="mt-2 space-y-2">
                      {proofs.length === 0 ? (
                        <div className="text-xs text-slate-400">
                          No recent signatures found for this dispute account.
                        </div>
                      ) : (
                        proofs.map((sig) => (
                          <a
                            key={sig}
                            className="text-xs text-indigo-300 hover:text-indigo-200 break-all"
                            href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {sig}
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {disputes.length === 0 && !loading && (
            <div className="text-sm text-slate-300">No disputes to display.</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-600 bg-slate-900/20">
          <div className="text-xs text-slate-400 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              Status mapping: <span className="text-slate-300">Pending</span> = Raised w/ no arbiter ·{" "}
              <span className="text-slate-300">Arbitrating</span> = arbiter assigned ·{" "}
              <span className="text-slate-300">Resolved</span> = final split stored on-chain
            </div>
            <div>Explorer links are shown for recent dispute account signatures.</div>
          </div>
        </div>
      </div>
    </section>
  );
};
