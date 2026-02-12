declare module "@solana/web3.js" {
  export type Cluster = "devnet" | "testnet" | "mainnet-beta" | string;

  export function clusterApiUrl(cluster?: Cluster, tls?: boolean): string;
}
