"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wallet_1 = require("../src/wallet");
describe('WalletManager', () => {
    it('creates a valid keypair', () => {
        const kp = wallet_1.WalletManager.createWallet();
        expect(kp.publicKey()).toBeDefined();
    });
});
