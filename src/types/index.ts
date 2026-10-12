import { Transaction } from '@stellar/stellar-sdk';

export interface PolicyRule {
  name: string;
  validate(tx: Transaction): void;
}

export interface MaxAmountRuleOptions {
  maxStroops: string;
}

export interface AllowedDestinationsOptions {
  destinations: string[];
}

export type AllowedDestinationsRuleOptions = AllowedDestinationsOptions;

export interface TurretUploadResponse {
  hash: string;
  signer: string;
  fee: string;
  url: string;
}

export interface LedgerSignerOptions {
  derivationPath?: string; // e.g. "m/44'/148'/0'"
}

export type MemoType = 'text' | 'id' | 'hash' | 'return' | 'none';

export interface MemoValidationRuleOptions {
  /**
   * Allowed memo types. If omitted, all standard Stellar memo types ('text', 'id', 'hash', 'return', 'none') are permitted.
   */
  allowedTypes?: MemoType[];

  /**
   * Maximum allowed byte length for text memos (Stellar protocol limit is 28 bytes).
   * Default: 28.
   */
  maxTextBytes?: number;

  /**
   * Whether a memo is strictly required (i.e. 'none' / empty memo is rejected).
   * Default: false.
   */
  required?: boolean;

  /**
   * Optional list of regex patterns that text memos must not match.
   */
  disallowedPatterns?: RegExp[];
}
