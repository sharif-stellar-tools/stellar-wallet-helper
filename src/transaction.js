"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxManager = void 0;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
/** Manages building and submitting Stellar transactions via a Horizon server. */
class TxManager {
    /**
     * Creates a new TxManager connected to the specified Horizon server.
     *
     * @param serverUrl - The base URL of the Stellar Horizon server (e.g. `'https://horizon-testnet.stellar.org'`).
     */
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.server = new stellar_sdk_1.Horizon.Server(this.serverUrl);
    }
    /**
     * Builds a Stellar payment transaction from a source account to a destination account.
     *
     * @param source - The Stellar account ID (public key) of the payment sender.
     * @param dest - The Stellar account ID (public key) of the payment recipient.
     * @param amount - The amount of XLM to send, expressed as a string (e.g. `'10.5'`).
     * @returns A Promise that resolves to the base64-encoded XDR transaction envelope.
     */
    async buildPayment(source, dest, amount) {
        const sourceAccount = await this.server.loadAccount(source);
        let baseFee = '100';
        try {
            const feeStats = await this.server.feeStats();
            if (feeStats && feeStats.fee_charged && feeStats.fee_charged.mode) {
                baseFee = feeStats.fee_charged.mode;
            }
            else if (feeStats && feeStats.last_ledger_base_fee) {
                baseFee = feeStats.last_ledger_base_fee;
            }
        }
        catch (e) {
            // Fallback to default base fee
        }
        let networkPassphrase = stellar_sdk_1.Networks.TESTNET;
        try {
            const rootInfo = await this.server.root();
            if (rootInfo && rootInfo.network_passphrase) {
                networkPassphrase = rootInfo.network_passphrase;
            }
        }
        catch (e) {
            // Fallback to default Networks.TESTNET
        }
        const tx = new stellar_sdk_1.TransactionBuilder(sourceAccount, {
            fee: baseFee,
            networkPassphrase,
        })
            .addOperation(stellar_sdk_1.Operation.payment({
            destination: dest,
            asset: stellar_sdk_1.Asset.native(),
            amount,
        }))
            .setTimeout(30)
            .build();
        return tx.toXDR();
    }
}
exports.TxManager = TxManager;
