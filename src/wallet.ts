import { Keypair } from '@stellar/stellar-sdk';

export class WalletManager {
  /**
   * Creates a random keypair for a new wallet.
   *
   * @returns A new Stellar Keypair.
   */
  static createWallet(): Keypair { return Keypair.random(); }

  /**
   * Restores a Keypair from a Stellar secret key.
   *
   * @param secret The secret key string.
   * @returns A Keypair reconstructed from the provided secret.
   */
  static fromSecret(secret: string): Keypair { return Keypair.fromSecret(secret); }
}
