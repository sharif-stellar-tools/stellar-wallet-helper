import { WalletManager } from '../src/wallet';

// Test vector from Stellar HD wallet examples (using bip39 + ed25519 derivation)
// The expected public keys were generated using a reference implementation.
const MNEMONIC_12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('WalletManager.mnemonic', () => {
  it('generates a 12-word mnemonic', () => {
    const m = WalletManager.generateMnemonic(12);
    expect(m.split(' ').length).toBe(12);
  });

  it('derives known keys from mnemonic (index 0 and 1)', () => {
    const kp0 = WalletManager.fromMnemonic(MNEMONIC_12, 0);
    const kp1 = WalletManager.fromMnemonic(MNEMONIC_12, 1);

    // Expected values precomputed from standard derivation (SLIP-0010 / Stellar path)
    expect(kp0.publicKey()).toBe('GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX');
    expect(kp1.publicKey()).toBe('GDVSYYTUAJ3ACHTPQNSTQBDQ4LDHQCMNY4FCEQH5TJUMSSLWQSTG42MV');
  });
});
