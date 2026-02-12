declare module '@solana/web3.js' {
  export class PublicKey {
    constructor(value: any);
    toBase58(): string;
  }

  export class Keypair {
    publicKey: PublicKey;
    static generate(): Keypair;
  }
}
