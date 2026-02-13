declare module "@solana/web3.js" {
  export type Cluster = "devnet" | "testnet" | "mainnet-beta" | string;

  export class PublicKey {
    constructor(value: string);
    toBase58(): string;
  }

  export function clusterApiUrl(cluster?: Cluster, tls?: boolean): string;

  export class Connection {
    getSignaturesForAddress(
      address: PublicKey,
      options?: { limit?: number },
      commitment?: unknown
    ): Promise<Array<{ signature: string }>>;

    getBlockTime(slot: number): Promise<number | null>;
  }
}

declare module "@coral-xyz/anchor" {
  export type Idl = unknown;

  export class AnchorProvider {
    constructor(connection: unknown, wallet: unknown, opts?: unknown);
  }

  export class Program {
    account: any;
    constructor(idl: unknown, programId: unknown, provider: unknown);
  }
}
