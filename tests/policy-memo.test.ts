import { SigningPolicyEngine, MemoValidationRule, PolicyViolationError } from '../src/policy';
import { TransactionBuilder, Operation, Asset, Keypair, Account, Memo, Transaction } from '@stellar/stellar-sdk';
import * as fc from 'fast-check';

describe('MemoValidationRule & Policy Engine (#120)', () => {
  const kp = Keypair.random();
  const destKp = Keypair.random();

  function buildTxWithMemo(memo?: any): Transaction {
    const account = new Account(kp.publicKey(), '100');
    const builder = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    if (memo) {
      builder.addMemo(memo);
    }

    builder.addOperation(
      Operation.payment({
        destination: destKp.publicKey(),
        asset: Asset.native(),
        amount: '1.0',
      })
    );

    builder.setTimeout(30);
    return builder.build();
  }

  function createMockTx(memo: any): Transaction {
    return {
      memo,
      operations: [],
      signatures: [],
    } as unknown as Transaction;
  }

  describe('Text Memo Validation', () => {
    it('allows valid text memo within 28 bytes', async () => {
      const rule = new MemoValidationRule();
      const tx = buildTxWithMemo(Memo.text('Payment for order #42'));
      expect(() => rule.validate(tx)).not.toThrow();
    });

    it('allows text memo of exactly 28 bytes', async () => {
      const rule = new MemoValidationRule();
      const exact28 = 'a'.repeat(28);
      const tx = buildTxWithMemo(Memo.text(exact28));
      expect(() => rule.validate(tx)).not.toThrow();
    });

    it('rejects text memo exceeding default 28 byte limit', () => {
      const rule = new MemoValidationRule();
      const over28 = 'a'.repeat(29);
      const tx = createMockTx({ type: 'text', value: over28 });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/exceeds the allowed limit of 28 bytes/);
    });

    it('correctly calculates UTF-8 multi-byte characters and rejects when byte length > 28', () => {
      const rule = new MemoValidationRule();
      // 8 emoji characters, each 4 bytes = 32 bytes total
      const emojis = '🚀🚀🚀🚀🚀🚀🚀🚀';
      expect(Buffer.byteLength(emojis, 'utf8')).toBe(32);

      const tx = createMockTx({ type: 'text', value: emojis });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/Text memo length of 32 bytes exceeds the allowed limit of 28 bytes/);
    });

    it('enforces custom maxTextBytes option', () => {
      const rule = new MemoValidationRule({ maxTextBytes: 10 });
      const tx1 = buildTxWithMemo(Memo.text('1234567890'));
      expect(() => rule.validate(tx1)).not.toThrow();

      const tx2 = createMockTx({ type: 'text', value: '12345678901' });
      expect(() => rule.validate(tx2)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx2)).toThrow(/exceeds the allowed limit of 10 bytes/);
    });

    it('enforces disallowedPatterns filtering', () => {
      const rule = new MemoValidationRule({
        disallowedPatterns: [/phish/i, /malicious/i],
      });

      const txSafe = buildTxWithMemo(Memo.text('Normal invoice memo'));
      expect(() => rule.validate(txSafe)).not.toThrow();

      const txPhish = buildTxWithMemo(Memo.text('Claim free phishing token'));
      expect(() => rule.validate(txPhish)).toThrow(PolicyViolationError);
      expect(() => rule.validate(txPhish)).toThrow(/matches disallowed pattern/);
    });
  });

  describe('ID Memo Validation', () => {
    it('allows valid 64-bit unsigned integer ID memos', () => {
      const rule = new MemoValidationRule();

      const txZero = buildTxWithMemo(Memo.id('0'));
      expect(() => rule.validate(txZero)).not.toThrow();

      const txMid = buildTxWithMemo(Memo.id('9876543210'));
      expect(() => rule.validate(txMid)).not.toThrow();

      const maxUint64 = '18446744073709551615';
      const txMax = buildTxWithMemo(Memo.id(maxUint64));
      expect(() => rule.validate(txMax)).not.toThrow();
    });

    it('rejects negative ID values', () => {
      const rule = new MemoValidationRule();
      const tx = createMockTx({ type: 'id', value: '-123' });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/not a valid 64-bit unsigned integer format/);
    });

    it('rejects non-numeric ID strings', () => {
      const rule = new MemoValidationRule();
      const tx = createMockTx({ type: 'id', value: '123abc456' });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/not a valid 64-bit unsigned integer format/);
    });

    it('rejects floating point ID values', () => {
      const rule = new MemoValidationRule();
      const tx = createMockTx({ type: 'id', value: '12345.67' });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/not a valid 64-bit unsigned integer format/);
    });

    it('rejects ID values exceeding uint64 maximum bound', () => {
      const rule = new MemoValidationRule();
      const overflowUint64 = '18446744073709551616'; // 2^64
      const tx = createMockTx({ type: 'id', value: overflowUint64 });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/outside the allowed 64-bit unsigned integer range/);
    });
  });

  describe('Hash & Return Hash Memo Validation', () => {
    const validHex32 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('allows valid 32-byte Hash memo', () => {
      const rule = new MemoValidationRule();
      const tx = buildTxWithMemo(Memo.hash(validHex32));
      expect(() => rule.validate(tx)).not.toThrow();
    });

    it('allows valid 32-byte Return hash memo', () => {
      const rule = new MemoValidationRule();
      const tx = buildTxWithMemo(Memo.return(validHex32));
      expect(() => rule.validate(tx)).not.toThrow();
    });

    it('allows 32-byte Buffer hash memo directly', () => {
      const rule = new MemoValidationRule();
      const tx = createMockTx({ type: 'hash', value: Buffer.alloc(32, 0x42) });
      expect(() => rule.validate(tx)).not.toThrow();
    });

    it('rejects hash memo with length less than 32 bytes', () => {
      const rule = new MemoValidationRule();
      const tx = createMockTx({ type: 'hash', value: Buffer.alloc(31, 0x01) });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/must be exactly 32 bytes \(received 31 bytes\)/);
    });

    it('rejects hash memo with length greater than 32 bytes', () => {
      const rule = new MemoValidationRule();
      const tx = createMockTx({ type: 'hash', value: Buffer.alloc(33, 0x01) });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/must be exactly 32 bytes \(received 33 bytes\)/);
    });

    it('rejects invalid hex characters in string hash memo', () => {
      const rule = new MemoValidationRule();
      const invalidHex = 'g'.repeat(64);
      const tx = createMockTx({ type: 'hash', value: invalidHex });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/must be valid hexadecimal encoding/);
    });

    it('rejects odd-length hex string for hash memo', () => {
      const rule = new MemoValidationRule();
      const oddHex = 'a'.repeat(63);
      const tx = createMockTx({ type: 'hash', value: oddHex });

      expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
      expect(() => rule.validate(tx)).toThrow(/invalid odd length/);
    });
  });

  describe('Allowed Types & Required Policies', () => {
    it('allows none memo by default', () => {
      const rule = new MemoValidationRule();
      const tx = buildTxWithMemo(Memo.none());
      expect(() => rule.validate(tx)).not.toThrow();
    });

    it('rejects none memo when required is set to true', () => {
      const rule = new MemoValidationRule({ required: true });
      const txNone = buildTxWithMemo(Memo.none());
      expect(() => rule.validate(txNone)).toThrow(PolicyViolationError);
      expect(() => rule.validate(txNone)).toThrow(/Transaction policy requires a memo, but none was provided/);

      const txValid = buildTxWithMemo(Memo.text('order-123'));
      expect(() => rule.validate(txValid)).not.toThrow();
    });

    it('enforces allowedTypes restriction (e.g. only text or id allowed)', () => {
      const rule = new MemoValidationRule({
        allowedTypes: ['text', 'id'],
      });

      const txText = buildTxWithMemo(Memo.text('Hello'));
      expect(() => rule.validate(txText)).not.toThrow();

      const txId = buildTxWithMemo(Memo.id('12345'));
      expect(() => rule.validate(txId)).not.toThrow();

      const txHash = buildTxWithMemo(Memo.hash('a'.repeat(64)));
      expect(() => rule.validate(txHash)).toThrow(PolicyViolationError);
      expect(() => rule.validate(txHash)).toThrow(/Memo type "hash" is not permitted by policy/);

      const txNone = buildTxWithMemo(Memo.none());
      expect(() => rule.validate(txNone)).toThrow(PolicyViolationError);
      expect(() => rule.validate(txNone)).toThrow(/Memo type "none" is not permitted by policy/);
    });
  });

  describe('SigningPolicyEngine Integration', () => {
    it('validates and signs transaction when memo satisfies all policy rules', async () => {
      const engine = new SigningPolicyEngine([
        new MemoValidationRule({ allowedTypes: ['text', 'id'], maxTextBytes: 28 }),
      ]);

      const tx = buildTxWithMemo(Memo.text('Valid memo'));
      const signedTx = await engine.validateAndSign(tx, kp.secret());

      expect(signedTx.signatures.length).toBe(1);
    });

    it('aborts signing and throws PolicyViolationError when memo violates policy', async () => {
      const engine = new SigningPolicyEngine([
        new MemoValidationRule({ required: true }),
      ]);

      const tx = buildTxWithMemo(Memo.none());
      await expect(engine.validateAndSign(tx, kp.secret())).rejects.toThrow(PolicyViolationError);
      expect(tx.signatures.length).toBe(0);
    });
  });

  describe('Property-Based Fast-Check Tests', () => {
    it('validates all arbitrary ASCII strings <= 28 characters without throwing', () => {
      const rule = new MemoValidationRule();
      fc.assert(
        fc.property(fc.string({ maxLength: 28 }), (randomStr) => {
          // ensure pure ASCII so byte length <= 28
          const asciiStr = randomStr.replace(/[^\x20-\x7E]/g, 'a');
          const tx = buildTxWithMemo(Memo.text(asciiStr));
          expect(() => rule.validate(tx)).not.toThrow();
        }),
        { numRuns: 50 }
      );
    });

    it('validates all arbitrary BigInt values within 0 to 2^64 - 1 without throwing', () => {
      const rule = new MemoValidationRule();
      const MAX_UINT64 = 18446744073709551615n;
      fc.assert(
        fc.property(fc.bigInt({ min: 0n, max: MAX_UINT64 }), (randomId) => {
          const tx = buildTxWithMemo(Memo.id(randomId.toString()));
          expect(() => rule.validate(tx)).not.toThrow();
        }),
        { numRuns: 50 }
      );
    });
  });
});
