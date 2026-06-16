import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { addSignerToTransaction, checkSignatureThreshold } from '../src/multisig';
import { WalletManager } from '../src/wallet';

function buildSampleTransaction(sourceKeypair: Keypair) {
  const destination = Keypair.random().publicKey();
  const source = new Account(sourceKeypair.publicKey(), '0');

  return new TransactionBuilder(source, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount: '10',
      })
    )
    .setTimeout(30)
    .build();
}

describe('multisig', () => {
  describe('addSignerToTransaction', () => {
    it('adds a signature from the signer keypair', () => {
      const source = WalletManager.createWallet();
      const transaction = buildSampleTransaction(source);

      expect(transaction.signatures).toHaveLength(0);

      const signed = addSignerToTransaction(transaction, source);

      expect(signed.signatures).toHaveLength(1);
      expect(signed).toBe(transaction);
    });

    it('accumulates signatures from multiple signers', () => {
      const source = WalletManager.createWallet();
      const cosigner = WalletManager.createWallet();
      const transaction = buildSampleTransaction(source);

      addSignerToTransaction(transaction, source);
      addSignerToTransaction(transaction, cosigner);

      expect(transaction.signatures).toHaveLength(2);
    });
  });

  describe('checkSignatureThreshold', () => {
    it('returns false when signatures are below the threshold', () => {
      const source = WalletManager.createWallet();
      const transaction = buildSampleTransaction(source);

      expect(checkSignatureThreshold(transaction, 1)).toBe(false);
    });

    it('returns true when signature count meets the threshold', () => {
      const source = WalletManager.createWallet();
      const cosigner = WalletManager.createWallet();
      const transaction = buildSampleTransaction(source);

      addSignerToTransaction(transaction, source);
      addSignerToTransaction(transaction, cosigner);

      expect(checkSignatureThreshold(transaction, 2)).toBe(true);
    });

    it('returns true for non-positive thresholds', () => {
      const source = WalletManager.createWallet();
      const transaction = buildSampleTransaction(source);

      expect(checkSignatureThreshold(transaction, 0)).toBe(true);
    });
  });
});
