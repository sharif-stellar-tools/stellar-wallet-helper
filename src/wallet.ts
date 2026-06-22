import { Keypair } from "@stellar/stellar-sdk";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { split, combine } from "./utils/sss";

/** Provides utility methods for creating and restoring Stellar wallets. */
export class WalletManager {
  /**
   * Creates a new random Stellar keypair (public + secret key pair).
   *
   * @returns A newly generated random {@link Keypair}.
   */
  static createWallet(): Keypair {
    return Keypair.random();
  }

  /**
   * Restores a Stellar keypair from an existing secret (private) key.
   *
   * @param secret - The base32-encoded Stellar secret key (starts with 'S').
   * @returns The {@link Keypair} derived from the provided secret key.
   */
  static fromSecret(secret: string): Keypair {
    return Keypair.fromSecret(secret);
  }

  /**
   * Generates a new BIP-39 mnemonic phrase.
   *
   * @param words - Number of words in the mnemonic (12 or 24). Defaults to 12.
   */
  static generateMnemonic(words: 12 | 24 = 12): string {
    const strength = words === 12 ? 128 : 256; // entropy bits
    return bip39.generateMnemonic(strength);
  }

  /**
   * Derives a Stellar Keypair from a BIP-39 mnemonic following BIP-44 path m/44'/148'/index'.
   *
   * @param mnemonic - The BIP-39 seed phrase.
   * @param index - The account index to derive (non-negative integer).
   */
  static fromMnemonic(mnemonic: string, index = 0): Keypair {
    if (!bip39.validateMnemonic(mnemonic)) throw new Error("Invalid mnemonic");
    if (!Number.isInteger(index) || index < 0) throw new Error("Invalid index");

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const path = `m/44'/148'/${index}'`;
    const { key } = derivePath(path, seed.toString("hex"));
    // key is a 32-byte private key for ed25519 — Stellar's Keypair.fromRawEd25519Seed accepts it
    return Keypair.fromRawEd25519Seed(key);
  }

  /**
   * Splits a mnemonic phrase into M-of-N shards using Shamir's Secret Sharing.
   *
   * @param mnemonic - The BIP-39 mnemonic phrase to split.
   * @param threshold - The minimum number of shards required to reconstruct the mnemonic.
   * @param numShards - The total number of shards to generate.
   * @returns An array of shards, each represented as a hex string.
   */
  static splitMnemonic(
    mnemonic: string,
    threshold: number,
    numShards: number
  ): string[] {
    if (!bip39.validateMnemonic(mnemonic)) throw new Error("Invalid mnemonic");
    const secret = new TextEncoder().encode(mnemonic);
    const shares = split(secret, threshold, numShards);
    return shares.map((s) => Buffer.from(s).toString("hex"));
  }

  /**
   * Reconstructs a mnemonic phrase from a set of shards.
   *
   * @param shards - An array of shards (hex strings).
   * @returns The reconstructed BIP-39 mnemonic phrase.
   */
  static combineMnemonic(shards: string[]): string {
    if (!shards || shards.length === 0) throw new Error("No shards provided");
    const shares = shards.map((s) => new Uint8Array(Buffer.from(s, "hex")));
    const secret = combine(shares);
    const mnemonic = new TextDecoder().decode(secret);
    if (!bip39.validateMnemonic(mnemonic))
      throw new Error("Reconstructed mnemonic is invalid");
    return mnemonic;
  }
}

