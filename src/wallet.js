"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletManager = void 0;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const bip39 = __importStar(require("bip39"));
const ed25519_hd_key_1 = require("ed25519-hd-key");
/** Provides utility methods for creating and restoring Stellar wallets. */
class WalletManager {
    /**
     * Creates a new random Stellar keypair (public + secret key pair).
     *
     * @returns A newly generated random {@link Keypair}.
     */
    static createWallet() {
        return stellar_sdk_1.Keypair.random();
    }
    /**
     * Restores a Stellar keypair from an existing secret (private) key.
     *
     * @param secret - The base32-encoded Stellar secret key (starts with 'S').
     * @returns The {@link Keypair} derived from the provided secret key.
     */
    static fromSecret(secret) {
        return stellar_sdk_1.Keypair.fromSecret(secret);
    }
    /**
     * Generates a new BIP-39 mnemonic phrase.
     *
     * @param words - Number of words in the mnemonic (12 or 24). Defaults to 12.
     */
    static generateMnemonic(words = 12) {
        const strength = words === 12 ? 128 : 256; // entropy bits
        return bip39.generateMnemonic(strength);
    }
    /**
     * Derives a Stellar Keypair from a BIP-39 mnemonic following BIP-44 path m/44'/148'/index'.
     *
     * @param mnemonic - The BIP-39 seed phrase.
     * @param index - The account index to derive (non-negative integer).
     */
    static fromMnemonic(mnemonic, index = 0) {
        if (!bip39.validateMnemonic(mnemonic))
            throw new Error("Invalid mnemonic");
        if (!Number.isInteger(index) || index < 0)
            throw new Error("Invalid index");
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const path = `m/44'/148'/${index}'`;
        const { key } = (0, ed25519_hd_key_1.derivePath)(path, seed.toString("hex"));
        // key is a 32-byte private key for ed25519 — Stellar's Keypair.fromRawEd25519Seed accepts it
        return stellar_sdk_1.Keypair.fromRawEd25519Seed(key);
    }
}
exports.WalletManager = WalletManager;
