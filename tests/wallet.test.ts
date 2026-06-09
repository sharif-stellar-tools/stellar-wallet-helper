import { WalletManager } from '../src/wallet';

describe('WalletManager', () => {
  it('creates a valid keypair', () => {
    const kp = WalletManager.createWallet();
    expect(kp.publicKey()).toBeDefined();
  });
});
