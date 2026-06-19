"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const multisig_1 = require("../src/multisig");
const wallet_1 = require("../src/wallet");
function buildSampleTransaction(sourceKeypair) {
    const destination = stellar_sdk_1.Keypair.random().publicKey();
    const source = new stellar_sdk_1.Account(sourceKeypair.publicKey(), '0');
    return new stellar_sdk_1.TransactionBuilder(source, {
        fee: '100',
        networkPassphrase: stellar_sdk_1.Networks.TESTNET,
    })
        .addOperation(stellar_sdk_1.Operation.payment({
        destination,
        asset: stellar_sdk_1.Asset.native(),
        amount: '10',
    }))
        .setTimeout(30)
        .build();
}
describe('multisig', () => {
    describe('addSignerToTransaction', () => {
        it('adds a signature from the signer keypair', () => {
            const source = wallet_1.WalletManager.createWallet();
            const transaction = buildSampleTransaction(source);
            expect(transaction.signatures).toHaveLength(0);
            const signed = (0, multisig_1.addSignerToTransaction)(transaction, source);
            expect(signed.signatures).toHaveLength(1);
            expect(signed).toBe(transaction);
        });
        it('accumulates signatures from multiple signers', () => {
            const source = wallet_1.WalletManager.createWallet();
            const cosigner = wallet_1.WalletManager.createWallet();
            const transaction = buildSampleTransaction(source);
            (0, multisig_1.addSignerToTransaction)(transaction, source);
            (0, multisig_1.addSignerToTransaction)(transaction, cosigner);
            expect(transaction.signatures).toHaveLength(2);
        });
    });
    describe('checkSignatureThreshold', () => {
        it('returns false when signatures are below the threshold', () => {
            const source = wallet_1.WalletManager.createWallet();
            const transaction = buildSampleTransaction(source);
            expect((0, multisig_1.checkSignatureThreshold)(transaction, 1)).toBe(false);
        });
        it('returns true when signature count meets the threshold', () => {
            const source = wallet_1.WalletManager.createWallet();
            const cosigner = wallet_1.WalletManager.createWallet();
            const transaction = buildSampleTransaction(source);
            (0, multisig_1.addSignerToTransaction)(transaction, source);
            (0, multisig_1.addSignerToTransaction)(transaction, cosigner);
            expect((0, multisig_1.checkSignatureThreshold)(transaction, 2)).toBe(true);
        });
        it('returns true for non-positive thresholds', () => {
            const source = wallet_1.WalletManager.createWallet();
            const transaction = buildSampleTransaction(source);
            expect((0, multisig_1.checkSignatureThreshold)(transaction, 0)).toBe(true);
        });
    });
});
