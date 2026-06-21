"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wallet_1 = require("../src/wallet");
describe("WalletManager – keypair generation and validation", () => {
    describe("createWallet", () => {
        it("returns a keypair with a public key starting with 'G'", () => {
            const kp = wallet_1.WalletManager.createWallet();
            expect(kp.publicKey()).toMatch(/^G[A-Z2-7]{55}$/);
        });
        it("returns a keypair with a secret key starting with 'S'", () => {
            const kp = wallet_1.WalletManager.createWallet();
            expect(kp.secret()).toMatch(/^S[A-Z2-7]{55}$/);
        });
        it("generates a unique keypair each call", () => {
            const kp1 = wallet_1.WalletManager.createWallet();
            const kp2 = wallet_1.WalletManager.createWallet();
            expect(kp1.publicKey()).not.toBe(kp2.publicKey());
        });
    });
    describe("fromSecret", () => {
        it("restores the same public key from a secret", () => {
            const kp = wallet_1.WalletManager.createWallet();
            const restored = wallet_1.WalletManager.fromSecret(kp.secret());
            expect(restored.publicKey()).toBe(kp.publicKey());
        });
        it("throws on an invalid secret key", () => {
            expect(() => wallet_1.WalletManager.fromSecret("INVALID")).toThrow();
        });
    });
    describe("generateMnemonic", () => {
        it("generates a 12-word mnemonic by default", () => {
            const mnemonic = wallet_1.WalletManager.generateMnemonic();
            expect(mnemonic.trim().split(/\s+/)).toHaveLength(12);
        });
        it("generates a 24-word mnemonic when requested", () => {
            const mnemonic = wallet_1.WalletManager.generateMnemonic(24);
            expect(mnemonic.trim().split(/\s+/)).toHaveLength(24);
        });
    });
    describe("fromMnemonic", () => {
        const MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        it("derives a keypair with a valid Stellar public key", () => {
            const kp = wallet_1.WalletManager.fromMnemonic(MNEMONIC);
            expect(kp.publicKey()).toMatch(/^G[A-Z2-7]{55}$/);
        });
        it("derives deterministically – same mnemonic yields same keypair", () => {
            const kp1 = wallet_1.WalletManager.fromMnemonic(MNEMONIC);
            const kp2 = wallet_1.WalletManager.fromMnemonic(MNEMONIC);
            expect(kp1.publicKey()).toBe(kp2.publicKey());
        });
        it("derives different keypairs for different account indices", () => {
            const kp0 = wallet_1.WalletManager.fromMnemonic(MNEMONIC, 0);
            const kp1 = wallet_1.WalletManager.fromMnemonic(MNEMONIC, 1);
            expect(kp0.publicKey()).not.toBe(kp1.publicKey());
        });
        it("throws on an invalid mnemonic", () => {
            expect(() => wallet_1.WalletManager.fromMnemonic("not a valid mnemonic")).toThrow("Invalid mnemonic");
        });
        it("throws on a negative account index", () => {
            expect(() => wallet_1.WalletManager.fromMnemonic(MNEMONIC, -1)).toThrow("Invalid index");
        });
    });
});
