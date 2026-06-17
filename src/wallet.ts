import { Keypair } from '@stellar/stellar-sdk';

/** Provides utility methods for creating and restoring Stellar wallets. */
export class WalletManager {
  /**
   * Creates a new random Stellar keypair (public + secret key pair).
   *
   * @returns A newly generated random {@link Keypair}.
   */
  static createWallet(): Keypair { return Keypair.random(); }

  /**
   * Restores a Stellar keypair from an existing secret (private) key.
   *
   * @param secret - The base32-encoded Stellar secret key (starts with 'S').
   * @returns The {@link Keypair} derived from the provided secret key.
   */
  static fromSecret(secret: string): Keypair { return Keypair.fromSecret(secret); }
}
