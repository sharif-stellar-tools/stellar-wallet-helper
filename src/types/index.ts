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

export interface TurretUploadResponse {
  hash: string;
  signer: string;
  fee: string;
  url: string;
}

export interface LedgerSignerOptions {
  derivationPath?: string; // e.g. "m/44'/148'/0'"
}
