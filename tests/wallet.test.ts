import { StrKey } from '@stellar/stellar-sdk';
import { WalletManager } from '../src/wallet';

describe('WalletManager', () => {
  it('creates a valid Stellar keypair', () => {
    const kp = WalletManager.createWallet();

    expect(StrKey.isValidEd25519PublicKey(kp.publicKey())).toBe(true);
    expect(StrKey.isValidEd25519SecretSeed(kp.secret())).toBe(true);
  });

  it('restores the same keypair from a valid secret', () => {
    const original = WalletManager.createWallet();
    const restored = WalletManager.fromSecret(original.secret());

    expect(restored.publicKey()).toBe(original.publicKey());
    expect(restored.secret()).toBe(original.secret());
  });

  it('rejects an invalid secret', () => {
    expect(() => WalletManager.fromSecret('not-a-stellar-secret')).toThrow();
  });
});
