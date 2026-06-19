"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const wallet_1 = require("../src/wallet");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isValidPublicKey, isValidSecretKey } = require('../src/index.js');
describe('stellar-wallet-helper key validation', () => {
    it('validates known public and secret keys', () => {
        const keypair = wallet_1.WalletManager.createWallet();
        expect(isValidPublicKey(keypair.publicKey())).toBe(true);
        expect(isValidSecretKey(keypair.secret())).toBe(true);
        expect(stellar_sdk_1.StrKey.isValidEd25519PublicKey(keypair.publicKey())).toBe(true);
        expect(stellar_sdk_1.StrKey.isValidEd25519SecretSeed(keypair.secret())).toBe(true);
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
        expect(() => isValidPublicKey(undefined)).not.toThrow();
        expect(() => isValidSecretKey(undefined)).not.toThrow();
        expect(() => isValidPublicKey(null)).not.toThrow();
        expect(() => isValidSecretKey(null)).not.toThrow();
        expect(isValidPublicKey(undefined)).toBe(false);
        expect(isValidSecretKey(undefined)).toBe(false);
        expect(isValidPublicKey(null)).toBe(false);
        expect(isValidSecretKey(null)).toBe(false);
    });
});
