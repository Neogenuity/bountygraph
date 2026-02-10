import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface Bounty {
  id: string;
  title: string;
  description: string;
  creator: string;
  totalAmount: number;
  releasedAmount: number;
  milestoneCount: number;
  completedMilestones: number;
  status: string;
}

const BountiesPage: React.FC = () => {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('all');

  const filteredBounties = bounties.filter((b) => {
    if (filter === 'open') return b.status === 'open';
    if (filter === 'completed') return b.status === 'completed';
    return true;
  });

  return (
    <>
      <Head>
        <title>Bounties - BountyGraph</title>
        <meta name="description" content="Browse bounties on BountyGraph" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        {/* Navigation */}
        <nav className="border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-indigo-500">
              BountyGraph
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/bounties" className="text-white border-b-2 border-indigo-500 pb-1">
                Browse Bounties
              </Link>
              <Link href="/dashboard" className="text-slate-300 hover:text-white">
                Dashboard
              </Link>
              <WalletMultiButton />
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">Bounties</h1>
            <Link
              href="/create"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
            >
              Create Bounty
            </Link>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-8">
            {(['all', 'open', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Bounties List */}
          <div className="space-y-4">
            {filteredBounties.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No bounties found</p>
                <p className="text-slate-500 mt-2">Create the first bounty or check back later</p>
              </div>
            ) : (
              filteredBounties.map((bounty) => (
                <Link key={bounty.id} href={`/bounties/${bounty.id}`}>
                  <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600 hover:border-indigo-500 transition cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-white">{bounty.title}</h3>
                        <p className="text-slate-400 mt-1">{bounty.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-500">${bounty.totalAmount}</div>
                        <div className="text-sm text-slate-400 mt-1">
                          {bounty.status === 'open' ? (
                            <span className="text-green-400">Open</span>
                          ) : (
                            <span className="text-gray-400">Completed</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm text-slate-400">
                          {bounty.completedMilestones} / {bounty.milestoneCount} milestones
                        </div>
                        <div className="w-48 h-2 bg-slate-600 rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500"
                            style={{
                              width: `${
                                (bounty.completedMilestones / bounty.milestoneCount) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Released</div>
                        <div className="text-lg font-semibold text-indigo-500">${bounty.releasedAmount}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BountiesPage;
