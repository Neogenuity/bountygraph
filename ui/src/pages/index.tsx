import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';

interface BountyStats {
  totalBounties: number;
  activeBounties: number;
  totalVolume: number;
  totalPayouts: number;
}

const Home: React.FC = () => {
  const { publicKey } = useWallet();
  const [stats, setStats] = useState<BountyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Mock stats for now
        setStats({
          totalBounties: 0,
          activeBounties: 0,
          totalVolume: 0,
          totalPayouts: 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <>
      <Head>
        <title>BountyGraph - On-Chain Bounty Verification</title>
        <meta name="description" content="BountyGraph: Verification-gated bounty escrow on Solana" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        {/* Navigation */}
        <nav className="border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-indigo-500">BountyGraph</div>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/bounties" className="text-slate-300 hover:text-white">
                Browse Bounties
              </Link>
              <Link href="/dashboard" className="text-slate-300 hover:text-white">
                Dashboard
              </Link>
              <WalletMultiButton />
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold text-white mb-6">
                Verification-Gated Bounty Escrow
              </h1>
              <p className="text-xl text-slate-300 mb-8">
                BountyGraph enables agents to earn cryptographically-verified rewards for completing
                computational tasks. Proof-of-work receipts, dependency graphs, and automated escrow
                on Solana.
              </p>
              <div className="flex gap-4">
                <Link
                  href="/bounties"
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
                >
                  Browse Bounties
                </Link>
                <Link
                  href="/create"
                  className="px-6 py-3 border border-indigo-600 hover:bg-indigo-600/10 text-indigo-400 rounded-lg font-semibold transition"
                >
                  Create Bounty
                </Link>
              </div>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-8 border border-slate-600">
              <h2 className="text-2xl font-bold text-white mb-6">Key Features</h2>
              <ul className="space-y-4 text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="text-indigo-500 mt-1">✓</span>
                  <span>On-chain proof-of-work receipts with artifact hashing</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-indigo-500 mt-1">✓</span>
                  <span>Multi-step task workflows with dependency graphs</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-indigo-500 mt-1">✓</span>
                  <span>Verification-gated escrow payouts (deterministic + oracle + optimistic)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-indigo-500 mt-1">✓</span>
                  <span>Worker reputation and historical activity tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-indigo-500 mt-1">✓</span>
                  <span>Real-time explorer dashboard with DAG visualization</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        {stats && !loading && (
          <section className="bg-slate-700/50 border-t border-b border-slate-600">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-500">
                    {stats.totalBounties}
                  </div>
                  <div className="text-slate-400 mt-2">Total Bounties</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-500">
                    {stats.activeBounties}
                  </div>
                  <div className="text-slate-400 mt-2">Active Now</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-500">
                    {stats.totalVolume}
                  </div>
                  <div className="text-slate-400 mt-2">Total Volume</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-500">
                    {stats.totalPayouts}
                  </div>
                  <div className="text-slate-400 mt-2">Total Paid Out</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Integrations Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Built to Integrate
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'ACR', desc: 'Reputation & trust scoring' },
              { name: 'AAP', desc: 'Agreement preconditions' },
              { name: 'SlotScribe', desc: 'Execution trace hashing' },
              { name: 'AMM Sentinel', desc: 'Structured data receipts' },
              { name: 'Agent Casino', desc: 'Multi-milestone hits' },
              { name: 'Helius', desc: 'Real-time event indexing' },
            ].map((integration) => (
              <div key={integration.name} className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                <h3 className="font-semibold text-white mb-2">{integration.name}</h3>
                <p className="text-slate-400 text-sm">{integration.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-700 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400">
            <p>Built by neogenuity for the Colosseum Agent Hackathon</p>
            <p className="text-sm mt-2">
              <Link href="https://github.com/neogenuity/bountygraph" className="text-indigo-400 hover:text-indigo-300">
                GitHub
              </Link>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home;
