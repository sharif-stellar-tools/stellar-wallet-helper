import axios from 'axios';
import { Transaction } from '@stellar/stellar-sdk';
import { TurretUploadResponse } from './types';

export class TurretClient {
  constructor(private turretUrl: string, private logger?: any) {}

  /**
   * Uploads an automated transaction to the Stellar Turret (SEP-23) runner.
   */
  public async uploadTransaction(
    tx: Transaction,
    signerSecret: string,
    runnerFields: { feeStroops: string; runTimeLimit: number }
  ): Promise<TurretUploadResponse> {
    const url = `${this.turretUrl}/tx`;
    const xdr = tx.toXDR();

    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info(`TurretClient: Uploading transaction XDR to ${url}`);
    }

    try {
      const response = await axios.post<TurretUploadResponse>(
        url,
        {
          tx_xdr: xdr,
          signer_secret: signerSecret,
          fee: runnerFields.feeStroops,
          time_limit: runnerFields.runTimeLimit,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      if (this.logger && typeof this.logger.error === 'function') {
        this.logger.error(`TurretClient: Failed to upload transaction: ${error.message}`);
      }
      throw new Error(`Turret Request Failed: ${error.response?.data?.error || error.message}`);
    }
  }
}
