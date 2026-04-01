import { Transaction } from '@stellar/stellar-sdk';
import { LedgerSignerOptions } from './types';

export class LedgerSigner {
  private derivationPath: string;

  constructor(options?: LedgerSignerOptions) {
    this.derivationPath = options?.derivationPath || "m/44'/148'/0'";
  }

  /**
   * Retrieves the Stellar public key from the connected Ledger hardware wallet.
   * This simulates WebHID communication using custom or mock transport.
   */
  public async getPublicKey(transport: any): Promise<string> {
    try {
      if (transport && typeof transport.getPublicKey === 'function') {
        return await transport.getPublicKey(this.derivationPath);
      }
      throw new Error('Invalid Ledger Transport provider');
    } catch (error: any) {
      throw new Error(`Ledger connection failed: ${error.message}`);
    }
  }

  /**
   * Signs a Stellar Transaction using the connected Ledger device.
   */
  public async signTransaction(tx: Transaction, transport: any): Promise<Transaction> {
    try {
      const txSignatureBase = tx.signatureBase();
      
      if (transport && typeof transport.signTransaction === 'function') {
        const signature = await transport.signTransaction(this.derivationPath, txSignatureBase);
        const pubKey = await this.getPublicKey(transport);
        tx.addSignature(pubKey, signature.toString('base64'));
        return tx;
      }
      throw new Error('Invalid Ledger Transport provider');
    } catch (error: any) {
      throw new Error(`Ledger transaction signing failed: ${error.message}`);
    }
  }
}
