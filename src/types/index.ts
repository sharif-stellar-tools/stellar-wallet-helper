import { Transaction } from "@stellar/stellar-sdk";

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

export interface AllowedOperationsRuleOptions {
  allowedOperations: string[];
}

export type MemoType = 'text' | 'id' | 'hash' | 'return' | 'none';

export interface MemoValidationRuleOptions {
  allowedTypes?: MemoType[];
  maxTextLength?: number;
  requireMemo?: boolean;
}

export interface TurretUploadResponse {
  hash: string;
  signer: string;
  fee: string;
  url: string;
}

export type LedgerTransportType = "webusb" | "webble" | "webhid";

export interface LedgerTransport {
  readonly type: LedgerTransportType;
  isSupported(): Promise<boolean>;
  connect(): Promise<void>;
  close(): Promise<void>;
  getPublicKey(derivationPath: string): Promise<string>;
  signTransaction(
    derivationPath: string,
    txSignatureBase: Buffer | Uint8Array
  ): Promise<Buffer | Uint8Array>;
}

export interface WebUsbTransportOptions {
  requestTimeoutMs?: number;
  usbVendorId?: number;
  device?: any;
}

export interface WebBleTransportOptions {
  serviceUuid?: string;
  scanTimeoutMs?: number;
  device?: any;
}

export interface WebHidTransportOptions {
  device?: any;
}

export interface LedgerSignerOptions {
  derivationPath?: string; // e.g. "m/44'/148'/0'"
  transportType?: LedgerTransportType;
  transport?: LedgerTransport | any;
}
