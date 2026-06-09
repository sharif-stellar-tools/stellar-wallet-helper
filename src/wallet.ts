import { Keypair } from '@stellar/stellar-sdk';

export class WalletManager {
  static createWallet(): Keypair { return Keypair.random(); }
  static fromSecret(secret: string): Keypair { return Keypair.fromSecret(secret); }
}
