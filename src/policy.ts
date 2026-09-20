import { Transaction, Keypair } from '@stellar/stellar-sdk';
import { PolicyRule, MaxAmountRuleOptions, AllowedDestinationsRuleOptions, MemoValidationRuleOptions, MemoType } from './types';

export class PolicyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyViolationError';
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
  private allowedTypes: Set<MemoType>;
  private maxTextBytes: number;
  private required: boolean;
  private disallowedPatterns: RegExp[];

  constructor(options?: MemoValidationRuleOptions) {
    this.allowedTypes = options?.allowedTypes
      ? new Set(options.allowedTypes)
      : new Set<MemoType>(['text', 'id', 'hash', 'return', 'none']);
    this.maxTextBytes = options?.maxTextBytes ?? 28;
    this.required = options?.required ?? false;
    this.disallowedPatterns = options?.disallowedPatterns ?? [];
  }

  public validate(tx: Transaction): void {
    const memo = tx.memo;
    const memoType = (memo?.type ?? 'none') as MemoType;

    // Check if memo is required by policy
    if (this.required && (memoType === 'none' || memo.value === null || memo.value === undefined)) {
      throw new PolicyViolationError('Transaction policy requires a memo, but none was provided.');
    }

    // Check if memo type is permitted by policy
    if (!this.allowedTypes.has(memoType)) {
      throw new PolicyViolationError(
        `Memo type "${memoType}" is not permitted by policy. Allowed types: ${Array.from(this.allowedTypes).join(', ')}.`
      );
    }

    if (memoType === 'none') {
      return;
    }

    switch (memoType) {
      case 'text':
        this.validateTextMemo(memo.value);
        break;
      case 'id':
        this.validateIdMemo(memo.value);
        break;
      case 'hash':
      case 'return':
        this.validateHashMemo(memo.value, memoType);
        break;
      default:
        throw new PolicyViolationError(`Unsupported memo type: "${memoType}".`);
    }
  }

  private validateTextMemo(value: any): void {
    if (value === null || value === undefined) {
      throw new PolicyViolationError('Text memo value cannot be null or undefined.');
    }
    const strValue = typeof value === 'string' ? value : String(value);
    const byteLength = Buffer.byteLength(strValue, 'utf8');

    if (byteLength > this.maxTextBytes) {
      throw new PolicyViolationError(
        `Text memo length of ${byteLength} bytes exceeds the allowed limit of ${this.maxTextBytes} bytes.`
      );
    }

    for (const pattern of this.disallowedPatterns) {
      if (pattern.test(strValue)) {
        throw new PolicyViolationError(
          `Text memo "${strValue}" matches disallowed pattern ${pattern.toString()}.`
        );
      }
    }
  }

  private validateIdMemo(value: any): void {
    if (value === null || value === undefined) {
      throw new PolicyViolationError('ID memo value cannot be null or undefined.');
    }

    const str = String(value).trim();
    if (!/^\d+$/.test(str)) {
      throw new PolicyViolationError(
        `ID memo "${str}" is not a valid 64-bit unsigned integer format.`
      );
    }

    try {
      const idBigInt = BigInt(str);
      const MAX_UINT64 = 18446744073709551615n; // 2^64 - 1
      if (idBigInt < 0n || idBigInt > MAX_UINT64) {
        throw new PolicyViolationError(
          `ID memo value ${str} is outside the allowed 64-bit unsigned integer range (0 to ${MAX_UINT64}).`
        );
      }
    } catch (err: any) {
      if (err instanceof PolicyViolationError) throw err;
      throw new PolicyViolationError(`Failed to parse ID memo as a 64-bit unsigned integer: ${err.message}`);
    }
  }

  private validateHashMemo(value: any, type: 'hash' | 'return'): void {
    const label = type === 'hash' ? 'Hash' : 'Return hash';
    if (value === null || value === undefined) {
      throw new PolicyViolationError(`${label} memo value cannot be null or undefined.`);
    }

    let byteLength = 0;
    if (Buffer.isBuffer(value)) {
      byteLength = value.length;
    } else if (value instanceof Uint8Array) {
      byteLength = value.byteLength;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
        throw new PolicyViolationError(`${label} memo string must be valid hexadecimal encoding.`);
      }
      if (trimmed.length % 2 !== 0) {
        throw new PolicyViolationError(`${label} memo hexadecimal string has invalid odd length.`);
      }
      byteLength = trimmed.length / 2;
    } else {
      throw new PolicyViolationError(
        `${label} memo must be a 32-byte Buffer, Uint8Array, or 64-character hexadecimal string.`
      );
    }

    if (byteLength !== 32) {
      throw new PolicyViolationError(
        `${label} memo must be exactly 32 bytes (received ${byteLength} bytes).`
      );
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
