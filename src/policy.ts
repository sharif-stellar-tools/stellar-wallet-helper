import { Transaction, Keypair } from '@stellar/stellar-sdk';
import {
  PolicyRule,
  MaxAmountRuleOptions,
  AllowedDestinationsRuleOptions,
  AllowedOperationsRuleOptions,
  MemoValidationRuleOptions,
} from './types';

export class PolicyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyViolationError';
  }
}

export class AllowedOperationsRule implements PolicyRule {
  public name = 'AllowedOperationsRule';
  private allowedOperations: Set<string>;

  constructor(options: AllowedOperationsRuleOptions) {
    this.allowedOperations = new Set(options.allowedOperations);
  }

  public validate(tx: Transaction): void {
    if (!tx.operations || tx.operations.length === 0) {
      return;
    }
    for (const op of tx.operations) {
      if (!this.allowedOperations.has(op.type)) {
        throw new PolicyViolationError(
          `Operation type "${op.type}" is not in the allowed operations whitelist: ${Array.from(this.allowedOperations).join(', ')}.`
        );
      }
    }
  }
}

export class MaxAmountRule implements PolicyRule {
  public name = 'MaxAmountRule';
  private maxStroops: bigint;

  constructor(options: MaxAmountRuleOptions) {
    this.maxStroops = BigInt(options.maxStroops);
  }

  public validate(tx: Transaction): void {
    for (const op of tx.operations) {
      if (op.type === 'payment') {
        // Convert Stellar standard string amount to stroops (amount * 10^7)
        const amountStroops = BigInt(Math.round(parseFloat(op.amount) * 10000000));
        if (amountStroops > this.maxStroops) {
          throw new PolicyViolationError(
            `Transaction operation amount of ${op.amount} XLM (${amountStroops} stroops) exceeds the allowed limit of ${this.maxStroops} stroops.`
          );
        }
      }
    }
  }
}

export class AllowedDestinationsRule implements PolicyRule {
  public name = 'AllowedDestinationsRule';
  private destinations: Set<string>;

  constructor(options: AllowedDestinationsRuleOptions) {
    this.destinations = new Set(options.destinations);
  }

  public validate(tx: Transaction): void {
    for (const op of tx.operations) {
      if (op.type === 'payment') {
        if (!this.destinations.has(op.destination)) {
          throw new PolicyViolationError(
            `Transaction destination address ${op.destination} is not in the allowed destinations list.`
          );
        }
      }
    }
  }
}

export class MemoValidationRule implements PolicyRule {
  public name = 'MemoValidationRule';
  private allowedTypes?: Set<string>;
  private maxTextLength: number;
  private requireMemo: boolean;

  constructor(options: MemoValidationRuleOptions = {}) {
    this.allowedTypes = options.allowedTypes ? new Set(options.allowedTypes) : undefined;
    this.maxTextLength = options.maxTextLength ?? 28;
    this.requireMemo = options.requireMemo ?? false;
  }

  public validate(tx: Transaction): void {
    const memo = tx.memo;
    const memoType = memo ? memo.type : 'none';

    if (this.requireMemo && (memoType === 'none' || !memo)) {
      throw new PolicyViolationError('Transaction requires a memo, but none was provided.');
    }

    if (this.allowedTypes && !this.allowedTypes.has(memoType)) {
      throw new PolicyViolationError(
        `Memo type "${memoType}" is not allowed. Allowed types: ${Array.from(this.allowedTypes).join(', ')}.`
      );
    }

    if (memoType === 'text') {
      const val = memo.value ? memo.value.toString() : '';
      const byteLength = Buffer.byteLength(val, 'utf8');
      if (byteLength > this.maxTextLength) {
        throw new PolicyViolationError(
          `Memo text length of ${byteLength} bytes exceeds the maximum allowed limit of ${this.maxTextLength} bytes.`
        );
      }
    } else if (memoType === 'id') {
      const val = memo.value ? memo.value.toString() : '';
      if (!/^\d+$/.test(val)) {
        throw new PolicyViolationError(`Memo ID "${val}" is not a valid 64-bit unsigned integer.`);
      }
      try {
        const bigVal = BigInt(val);
        const maxUint64 = BigInt('18446744073709551615');
        if (bigVal < 0n || bigVal > maxUint64) {
          throw new PolicyViolationError(`Memo ID exceeds 64-bit integer range.`);
        }
      } catch (err: unknown) {
        if (err instanceof PolicyViolationError) throw err;
        throw new PolicyViolationError(`Invalid Memo ID: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (memoType === 'hash' || memoType === 'return') {
      const val = memo.value;
      if (!val) {
        throw new PolicyViolationError(`Memo ${memoType} must contain a 32-byte hash.`);
      }
      const len = Buffer.isBuffer(val) ? val.length : Buffer.from(val, 'hex').length;
      if (len !== 32) {
        throw new PolicyViolationError(
          `Memo ${memoType} must be exactly 32 bytes, received ${len} bytes.`
        );
      }
    }
  }
}

export class SigningPolicyEngine {
  constructor(private rules: PolicyRule[]) {}

  /**
   * Validates a transaction against all configured rules and signs it if successful.
   */
  public async validateAndSign(tx: Transaction, secretKey: string): Promise<Transaction> {
    for (const rule of this.rules) {
      rule.validate(tx);
    }

    const kp = Keypair.fromSecret(secretKey);
    tx.sign(kp);
    return tx;
  }
}
