import { Keypair } from '@stellar/stellar-sdk';

export function createWallet() {
  return Keypair.random();
}
