import { StrKey } from '@stellar/stellar-sdk';
import { WalletManager } from '../src/wallet';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isValidPublicKey, isValidSecretKey } = require('../src/index.js');

describe('stellar-wallet-helper key validation', () => {
  it('validates known public and secret keys', () => {
    const keypair = WalletManager.createWallet();

    expect(isValidPublicKey(keypair.publicKey())).toBe(true);
    expect(isValidSecretKey(keypair.secret())).toBe(true);
    expect(StrKey.isValidEd25519PublicKey(keypair.publicKey())).toBe(true);
    expect(StrKey.isValidEd25519SecretSeed(keypair.secret())).toBe(true);
  });

  it('rejects malformed keys', () => {
    expect(isValidPublicKey('not-a-key')).toBe(false);
    expect(isValidSecretKey('not-a-secret')).toBe(false);
  });

  it('returns false for empty values', () => {
    expect(isValidPublicKey('')).toBe(false);
    expect(isValidSecretKey('')).toBe(false);
  });

  it('does not throw for non-string values', () => {
    expect(() => isValidPublicKey(undefined as unknown as string)).not.toThrow();
    expect(() => isValidSecretKey(undefined as unknown as string)).not.toThrow();
    expect(() => isValidPublicKey(null as unknown as string)).not.toThrow();
    expect(() => isValidSecretKey(null as unknown as string)).not.toThrow();

    expect(isValidPublicKey(undefined as unknown as string)).toBe(false);
    expect(isValidSecretKey(undefined as unknown as string)).toBe(false);
    expect(isValidPublicKey(null as unknown as string)).toBe(false);
    expect(isValidSecretKey(null as unknown as string)).toBe(false);
  });
});
