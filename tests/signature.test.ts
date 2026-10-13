import { verifySignature, SignatureVerifier } from '../src/signature';
import { Keypair } from '@stellar/stellar-sdk';

describe('SignatureVerifier & verifySignature helper', () => {
  const kp = Keypair.random();
  const otherKp = Keypair.random();

  it('should successfully verify valid signature for Buffer payload', () => {
    const payload = Buffer.from('offchain-telemetry-payload-data');
    const signature = kp.sign(payload);

    const isValid = verifySignature(payload, signature, kp.publicKey());
    expect(isValid).toBe(true);

    const isClassValid = SignatureVerifier.verifySignature(payload, signature, kp.publicKey());
    expect(isClassValid).toBe(true);
  });

  it('should successfully verify valid signature for string payload', () => {
    const payloadStr = 'user-auth-challenge-12345';
    const signature = kp.sign(Buffer.from(payloadStr, 'utf8'));

    const isValid = verifySignature(payloadStr, signature, kp.publicKey());
    expect(isValid).toBe(true);
  });

  it('should successfully verify hex-encoded signature string', () => {
    const payload = Buffer.from('arbitrary-contract-bytes');
    const signatureHex = kp.sign(payload).toString('hex');

    const isValid = verifySignature(payload, signatureHex, kp.publicKey());
    expect(isValid).toBe(true);
  });

  it('should reject signature created by a different keypair', () => {
    const payload = Buffer.from('secure-transaction-intent');
    const signature = otherKp.sign(payload);

    const isValid = verifySignature(payload, signature, kp.publicKey());
    expect(isValid).toBe(false);
  });

  it('should reject tampered payload with valid original signature', () => {
    const payload = Buffer.from('original-data');
    const tamperedPayload = Buffer.from('tampered-data');
    const signature = kp.sign(payload);

    const isValid = verifySignature(tamperedPayload, signature, kp.publicKey());
    expect(isValid).toBe(false);
  });

  it('should return false gracefully on invalid public key or corrupt signature bytes', () => {
    const payload = Buffer.from('test');
    expect(verifySignature(payload, Buffer.from([1, 2, 3]), 'INVALID_KEY')).toBe(false);
    expect(verifySignature(null as any, Buffer.from([1]), kp.publicKey())).toBe(false);
  });
});
