import { TransactionBuilder, Server, Networks } from '@stellar/stellar-sdk';

export class TxManager {
  constructor(private serverUrl: string) {}
  async buildPayment(source: string, dest: string, amount: string) {
    // Complex mock logic
    return true;
  }
}
