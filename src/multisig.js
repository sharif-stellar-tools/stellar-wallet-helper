"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSignerToTransaction = addSignerToTransaction;
exports.checkSignatureThreshold = checkSignatureThreshold;
/**
 * Adds a secondary signer to an existing transaction envelope.
 *
 * @param transaction The transaction to be signed.
 * @param signerKeypair The keypair of the secondary signer.
 * @returns The updated transaction containing the new signature.
 */
function addSignerToTransaction(transaction, signerKeypair) {
    transaction.sign(signerKeypair);
    return transaction;
}
/**
 * Checks if the transaction has met the required signature threshold.
 *
 * @param transaction The transaction to verify.
 * @param requiredThreshold The number of required signatures (M-of-N).
 * @returns True if the transaction has enough signatures, otherwise false.
 */
function checkSignatureThreshold(transaction, requiredThreshold) {
    return (requiredThreshold <= 0 || transaction.signatures.length >= requiredThreshold);
}
