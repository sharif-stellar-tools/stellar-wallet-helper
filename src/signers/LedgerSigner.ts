import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import StellarApp from '@ledgerhq/hw-app-str';

export class UserCancelledError extends Error {
  constructor(message = 'User cancelled the transaction on the Ledger device.') {
    super(message);
    this.name = 'UserCancelledError';
  }
}

export class LedgerSigner {
  private app: StellarApp | null = null;

  async initialize(transport?: any): Promise<void> {
    const activeTransport = transport || await TransportWebHID.create();
    this.app = new StellarApp(activeTransport);
  }

  async signTransaction(path: string, rawTxXdr: string): Promise<string> {
    if (!this.app) {
      await this.initialize();
    }

    try {
      const result = await this.app!.signTransaction(path, Buffer.from(rawTxXdr, 'hex'));
      return result.signature.toString('hex');
    } catch (error: any) {
      if (error?.statusCode === 0x6985 || error?.message?.toLowerCase().includes('denied') || error?.message?.toLowerCase().includes('cancelled')) {
        throw new UserCancelledError();
      }
      throw error;
    }
  }
}
