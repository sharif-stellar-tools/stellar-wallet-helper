import { Keypair } from '@stellar/stellar-sdk';

export class SignatureVerifier {
  /**
   * Validates whether a signature is valid for a given arbitrary payload buffer and Stellar public key.
   *
   * @param data The payload data (Buffer, Uint8Array, or string) that was signed.
   * @param signature The signature (Buffer, Uint8Array, or hex string) to verify.
   * @param publicKey The Stellar public key (StrKey G...) of the signer.
   * @returns boolean true if signature is cryptographically valid, false otherwise.
   */
  public static verifySignature(
    data: Buffer | Uint8Array | string,
    signature: Buffer | Uint8Array | string,
    publicKey: string
  ): boolean {
    if (!data || !signature || !publicKey) {
      return false;
    }

    try {
      const kp = Keypair.fromPublicKey(publicKey);

      const dataBuffer = Buffer.isBuffer(data)
        ? data
        : typeof data === 'string'
        ? Buffer.from(data, 'utf8')
        : Buffer.from(data);

      const sigBuffer = Buffer.isBuffer(signature)
        ? signature
        : typeof signature === 'string'
        ? (signature.length === 128 ? Buffer.from(signature, 'hex') : Buffer.from(signature, 'base64'))
        : Buffer.from(signature);

      return kp.verify(dataBuffer, sigBuffer);
    } catch {
      return false;
    }
  }
}

/**
 * Functional static convenience helper to verify off-chain payload signatures.
 */
export const verifySignature = SignatureVerifier.verifySignature;
