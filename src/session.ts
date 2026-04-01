import { Horizon, TransactionBuilder, Transaction } from '@stellar/stellar-sdk';

export class WalletSession {
  private sequenceNumber: string = '0';
  private baseFee: number = 100;
  private networkPassphrase: string = 'Test SDF Network ; September 2015'; // Default Testnet passphrase

  constructor(
    public readonly publicKey: string,
    private server: Horizon.Server,
    private horizonUrl: string
  ) {}

  /**
   * Factory method to load account sequence and details from Horizon.
   */
  public static async load(publicKey: string, horizonUrl: string): Promise<WalletSession> {
    const server = new Horizon.Server(horizonUrl);
    const session = new WalletSession(publicKey, server, horizonUrl);
    await session.refresh();
    return session;
  }

  /**
   * Refetches the account details from Horizon to resync state.
   */
  public async refresh(): Promise<void> {
    try {
      const account = await this.server.loadAccount(this.publicKey);
      this.sequenceNumber = account.sequenceNumber();
      
      const feeStats = await this.server.feeStats();
      this.baseFee = parseInt(feeStats.max_fee.mode, 10) || 100;
    } catch (error: any) {
      throw new Error(`Failed to load WalletSession for ${this.publicKey}: ${error.message}`);
    }
  }

  /**
   * Builds a transaction with automatically managed sequence number and base fee.
   */
  public buildTransaction(operations: any[]): Transaction {
    const currentSeq = BigInt(this.sequenceNumber);
    const nextSeq = (currentSeq + 1n).toString();

    const account = new Horizon.Account(this.publicKey, this.sequenceNumber);
    const builder = new TransactionBuilder(account, {
      fee: this.baseFee.toString(),
      networkPassphrase: this.networkPassphrase,
    });

    for (const op of operations) {
      builder.addOperation(op);
    }

    builder.setTimeout(300);

    const tx = builder.build();
    
    // Update local sequence cache to align with predicted state
    this.sequenceNumber = nextSeq;

    return tx;
  }

  public getCachedSequence(): string {
    return this.sequenceNumber;
  }

  public getCachedFee(): number {
    return this.baseFee;
  }
}
