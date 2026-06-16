import { Keypair, Transaction } from '@stellar/stellar-sdk';

export function addSignerToTransaction(
  transaction: Transaction,
  signerKeypair: Keypair
): Transaction {
  transaction.sign(signerKeypair);
  return transaction;
}

export function checkSignatureThreshold(
  transaction: Transaction,
  requiredThreshold: number
): boolean {
  if (requiredThreshold <= 0) {
    return true;
  }

  return transaction.signatures.length >= requiredThreshold;
}
