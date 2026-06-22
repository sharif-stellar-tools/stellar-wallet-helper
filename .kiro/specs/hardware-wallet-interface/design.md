# Design Document — Hardware Wallet Interface

## Overview

This document describes the technical design for the `hardware-wallet-interface` feature of `stellar-wallet-helper`. The feature adds a structured, device-agnostic layer for connecting to hardware wallets (starting with Ledger) and signing Stellar transactions via WebUSB or WebHID browser transports.

The design follows an **interface-first, injected transport factory** pattern. Application code depends solely on the `WalletProvider` interface and the `TransportFactory` type — never on `LedgerWalletProvider` directly. This keeps device-specific code isolated and allows future providers (e.g., Trezor) to be added without touching existing consumers.

The feature integrates cleanly with the existing SDK surface: `TxManager` builds transactions (XDR envelopes), and the new `LedgerWalletProvider` receives those envelopes, signs them via the hardware device, and returns `Transaction` objects with signatures attached and ready for Horizon submission.


## Architecture

### High-Level Component Interaction

```
┌──────────────────────────────────────────────────────┐
│                  Consumer / UI Code                   │
│  const provider: WalletProvider = new                 │
│    LedgerWalletProvider(createWebUsbTransport);       │
└──────────────────────────┬───────────────────────────┘
                           │ WalletProvider interface
           ┌───────────────▼────────────────┐
           │       LedgerWalletProvider      │
           │  - connect()                    │
           │  - getPublicKey()               │
           │  - signTransaction(xdr)         │
           └──────┬──────────────┬───────────┘
                  │              │
     TransportFactory        Stellar_App
    (@ledgerhq/hw-app-str)
         │
  ┌──────▼────────────────┐
  │  WebUSB  │  WebHID    │
  │ Transport│  Transport  │
  └──────────┴────────────┘
```

### Design Decisions

1. **Transport factory injection** — `LedgerWalletProvider` receives a `() => Promise<Transport>` callable in its constructor. This removes any `if/else` branch inside the provider for transport selection and lets the caller choose at the call site.

2. **Interface, not abstract class** — `WalletProvider` is a TypeScript `interface`. Future providers need no base class, no `super()` call, and no shared state.

3. **Error wrapping at every boundary** — all `try/catch` blocks in `LedgerWalletProvider` re-throw `HardwareWalletError`. Raw SDK errors never leak to callers.

4. **State guard** — `LedgerWalletProvider` holds a private `app: Str | null` field. Any public method that requires a connected device checks this field first and throws `NOT_CONNECTED` immediately.


## Components and Interfaces

### `WalletProvider` (interface)

The public contract. Lives in `src/hardware/walletProvider.ts`.

```typescript
import { Transaction } from "@stellar/stellar-sdk";

export interface WalletProvider {
  connect(): Promise<void>;
  getPublicKey(): Promise<string>;
  signTransaction(xdr: string): Promise<Transaction>;
}
```

No constructor signature is declared, keeping future implementations free to use any construction parameters. All rejections must be `HardwareWalletError` — this is a documented convention, not enforceable at the type level.

---

### `HardwareWalletError` (class)

Lives in `src/hardware/hardwareWalletError.ts`. Extends `Error` with a discriminated `code` field and preserves the original SDK error via the standard `cause` option.

```typescript
export type WalletErrorCode =
  | "TRANSPORT_ERROR"
  | "NOT_CONNECTED"
  | "DEVICE_LOCKED"
  | "USER_REJECTED"
  | "APP_NOT_OPEN"
  | "INVALID_TRANSACTION";

export class HardwareWalletError extends Error {
  readonly code: WalletErrorCode;

  constructor(code: WalletErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "HardwareWalletError";
    this.code = code;
  }
}
```

The `ErrorOptions` argument carries the `cause` field (standard in ES2022, available with `"target": "ES2020"` and `@types/node >= 18`). Callers use `instanceof HardwareWalletError` checks and switch on `.code`.


---

### `LedgerWalletProvider` (class)

Lives in `src/hardware/ledgerWalletProvider.ts`. Implements `WalletProvider`.

```typescript
import Str from "@ledgerhq/hw-app-str";
import type Transport from "@ledgerhq/hw-transport";
import { Transaction, xdr } from "@stellar/stellar-sdk";
import { HardwareWalletError } from "./hardwareWalletError";
import type { WalletProvider } from "./walletProvider";
import type { TransportFactory } from "./types";

const DERIVATION_PATH = "44'/148'/0'";

export class LedgerWalletProvider implements WalletProvider {
  private app: Str | null = null;
  private publicKey: string | null = null;

  constructor(private readonly transportFactory: TransportFactory) {}

  async connect(): Promise<void> { /* see Algorithms section */ }
  async getPublicKey(): Promise<string> { /* see Algorithms section */ }
  async signTransaction(xdrEnvelope: string): Promise<Transaction> { /* see Algorithms section */ }
}
```

The `app` field is `null` until `connect()` succeeds; every method that needs the device checks it first.

---

### Transport Factory Functions

Lives in `src/hardware/transports.ts`.

```typescript
export async function createWebUsbTransport(): Promise<Transport> { ... }
export async function createWebHidTransport(): Promise<Transport> { ... }
```

Both functions conform to `TransportFactory`. They check for browser API availability before calling the underlying SDK's `create()` method, and wrap any failure in `HardwareWalletError { code: "TRANSPORT_ERROR" }`.


## Data Models

```typescript
// src/hardware/types.ts

import type Transport from "@ledgerhq/hw-transport";
import type { WalletProvider } from "./walletProvider";

/**
 * Zero-argument async factory that opens and returns a Transport instance.
 * Pass createWebUsbTransport or createWebHidTransport as this type.
 */
export type TransportFactory = () => Promise<Transport>;

/**
 * Re-export for consumers who want to type-annotate a provider reference
 * without importing from a concrete file.
 */
export type { WalletProvider };
```

All public API surface uses `WalletProvider` (not `LedgerWalletProvider`) as the type for provider parameters and return values. `LedgerWalletProvider` is an implementation detail.

### Error Code Union

```typescript
// Defined in src/hardware/hardwareWalletError.ts

export type WalletErrorCode =
  | "TRANSPORT_ERROR"      // transport open failed, device disconnected mid-op
  | "NOT_CONNECTED"        // method called before connect() succeeded
  | "DEVICE_LOCKED"        // device screen is locked / requires PIN
  | "USER_REJECTED"        // user pressed reject on the device
  | "APP_NOT_OPEN"         // Stellar app is not open on the device
  | "INVALID_TRANSACTION"; // xdr argument could not be decoded
```


## Key Algorithms

### 1. `connect()` — Transport Injection and App Instantiation

```
connect():
  1. Invoke this.transportFactory() → await Transport
     On rejection: throw HardwareWalletError("TRANSPORT_ERROR", ..., { cause })
                   leave this.app = null
  2. Attempt: new Str(transport)
     On exception: throw HardwareWalletError("TRANSPORT_ERROR", ..., { cause })
                   leave this.app = null
  3. this.app = stellarApp
     (provider is now in connected state)
```

```typescript
async connect(): Promise<void> {
  let transport: Transport;
  try {
    transport = await this.transportFactory();
  } catch (err) {
    throw new HardwareWalletError(
      "TRANSPORT_ERROR",
      "Failed to open transport",
      { cause: err }
    );
  }
  try {
    this.app = new Str(transport);
  } catch (err) {
    throw new HardwareWalletError(
      "TRANSPORT_ERROR",
      "Failed to instantiate Stellar app",
      { cause: err }
    );
  }
}
```

---

### 2. `getPublicKey()` — BIP-44 Key Retrieval

```
getPublicKey():
  1. if this.app === null → throw HardwareWalletError("NOT_CONNECTED")
  2. await this.app.getPublicKey("44'/148'/0'")
     On SDK error: mapSdkError(err) → throw HardwareWalletError(mappedCode, ..., { cause })
  3. Cache result in this.publicKey
  4. return publicKey as string (G-address)
```

The derivation path `44'/148'/0'` is the Stellar BIP-44 standard path (coin type 148). The Ledger SDK returns the public key as a hex string; `@ledgerhq/hw-app-str` returns it already in the Stellar G-address format.


---

### 3. `signTransaction()` — XDR Decode → Sign → Attach Signature

```
signTransaction(xdrEnvelope):
  1. if this.app === null → throw HardwareWalletError("NOT_CONNECTED")
  2. Decode XDR:
       try { tx = new Transaction(xdrEnvelope, networkPassphrase) }
       catch → throw HardwareWalletError("INVALID_TRANSACTION", ..., { cause })
  3. Extract raw buffer:
       buffer = tx.signatureBase()  // returns Buffer of the signing payload
  4. Send to device:
       try { result = await this.app.signTransaction("44'/148'/0'", buffer) }
       catch (err) → mapSdkError(err) → throw HardwareWalletError(mappedCode, ...)
  5. Attach signature:
       tx.addSignature(this.publicKey!, result.signature)
  6. return tx
```

**Key detail on `signatureBase()`**: The Ledger device signs the raw transaction hash, not the full envelope. `Transaction.signatureBase()` from `@stellar/stellar-sdk` returns exactly the bytes the device needs — the network passphrase hash prepended to the transaction hash.

**`addSignature()`**: Accepts the Stellar G-address (public key string) and the raw signature buffer. This is the same API used by `Keypair.sign()` internally in the SDK.

---

### 4. Error Mapping — SDK Errors → `HardwareWalletError`

The Ledger SDK throws generic `Error` objects with structured `message` strings or `statusCode` / `id` fields. The mapping function inspects these fields:

```typescript
function mapSdkError(err: unknown): HardwareWalletError {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // Ledger error codes for locked device: 0x5515
    if (msg.includes("locked") || msg.includes("0x5515")) {
      return new HardwareWalletError("DEVICE_LOCKED", err.message, { cause: err });
    }
    // User rejection: 0x6985
    if (msg.includes("denied") || msg.includes("reject") || msg.includes("0x6985")) {
      return new HardwareWalletError("USER_REJECTED", err.message, { cause: err });
    }
    // App not open: 0x6e00
    if (msg.includes("not open") || msg.includes("0x6e00") || msg.includes("no app")) {
      return new HardwareWalletError("APP_NOT_OPEN", err.message, { cause: err });
    }
  }
  // Fallback for all unrecognised errors
  return new HardwareWalletError(
    "TRANSPORT_ERROR",
    err instanceof Error ? err.message : "Unknown hardware wallet error",
    { cause: err }
  );
}
```

This function is used in every `catch` block across `getPublicKey()` and `signTransaction()`.


---

### 5. Transport Factory Implementations

```typescript
// createWebUsbTransport
export async function createWebUsbTransport(): Promise<Transport> {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new HardwareWalletError("TRANSPORT_ERROR", "WebUSB is not supported in this browser");
  }
  try {
    const TransportWebUSB = (await import("@ledgerhq/hw-transport-webusb")).default;
    return await TransportWebUSB.create();
  } catch (err) {
    throw new HardwareWalletError("TRANSPORT_ERROR", "Failed to open WebUSB transport", { cause: err });
  }
}

// createWebHidTransport — identical shape, uses hw-transport-webhid
export async function createWebHidTransport(): Promise<Transport> {
  if (typeof navigator === "undefined" || !("hid" in navigator)) {
    throw new HardwareWalletError("TRANSPORT_ERROR", "WebHID is not supported in this browser");
  }
  try {
    const TransportWebHID = (await import("@ledgerhq/hw-transport-webhid")).default;
    return await TransportWebHID.create();
  } catch (err) {
    throw new HardwareWalletError("TRANSPORT_ERROR", "Failed to open WebHID transport", { cause: err });
  }
}
```

Dynamic imports are used so that neither `hw-transport-webusb` nor `hw-transport-webhid` are bundled unless the corresponding factory is called. This keeps tree-shaking possible in browser builds.


## File Structure

```
src/
└── hardware/
    ├── index.ts                  # barrel — re-exports public API
    ├── types.ts                  # TransportFactory, re-export WalletProvider
    ├── walletProvider.ts         # WalletProvider interface
    ├── hardwareWalletError.ts    # HardwareWalletError class + WalletErrorCode
    ├── ledgerWalletProvider.ts   # LedgerWalletProvider implements WalletProvider
    └── transports.ts             # createWebUsbTransport, createWebHidTransport

tests/
└── hardware/
    ├── hardwareWalletError.test.ts
    ├── ledgerWalletProvider.test.ts
    └── transports.test.ts
```

### `src/hardware/index.ts` (barrel)

```typescript
export type { WalletProvider } from "./walletProvider";
export type { TransportFactory } from "./types";
export { HardwareWalletError } from "./hardwareWalletError";
export type { WalletErrorCode } from "./hardwareWalletError";
export { LedgerWalletProvider } from "./ledgerWalletProvider";
export { createWebUsbTransport, createWebHidTransport } from "./transports";
```


## Public API Exports from `src/index.ts`

The existing `src/index.js` exports key-validation helpers. The TypeScript entry point (`src/index.ts`, to be created) will aggregate existing modules and the new hardware wallet surface:

```typescript
// src/index.ts
export { WalletManager } from "./wallet";
export { TxManager } from "./transaction";
export { addSignerToTransaction, checkSignatureThreshold } from "./multisig";

// Hardware wallet — all public names come through the barrel
export type { WalletProvider, TransportFactory, WalletErrorCode } from "./hardware";
export {
  HardwareWalletError,
  LedgerWalletProvider,
  createWebUsbTransport,
  createWebHidTransport,
} from "./hardware";
```

Consumers import from `"stellar-wallet-helper"` and type-annotate provider variables as `WalletProvider`, not `LedgerWalletProvider`.

## Dependencies

The following packages must be added to `package.json`:

```json
{
  "dependencies": {
    "@ledgerhq/hw-app-str": "^7.0.0",
    "@ledgerhq/hw-transport-webusb": "^6.29.0",
    "@ledgerhq/hw-transport-webhid": "^6.29.0"
  },
  "devDependencies": {
    "@ledgerhq/hw-transport": "^6.31.0"
  }
}
```

`@ledgerhq/hw-transport` is the abstract transport base type; it is a dev dependency because it is only needed for TypeScript typings — the runtime implementations (`webusb`, `webhid`) carry it as a peer dependency.

`@stellar/stellar-sdk` is already in `dependencies` at `15.1.0`.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

#### Reflection and Consolidation

After prework analysis, the following criteria were identified as property-testable (PROPERTY classification):

- 1.2, 1.4: all errors are HardwareWalletError; getPublicKey always returns a valid G-address
- 2.4: any TransportFactory rejection maps to TRANSPORT_ERROR
- 3.2: any valid public key from device is returned as a valid G-address
- 4.1: valid XDR always results in correct buffer passed to device
- 4.2: device signature is attached to transaction correctly
- 4.6: any invalid XDR string throws INVALID_TRANSACTION
- 5.2: error code is preserved on HardwareWalletError
- 5.3: message is preserved on HardwareWalletError
- 5.4: original error is preserved as cause
- 6.5: any transport SDK failure maps to TRANSPORT_ERROR with cause

**Reflection — consolidation:**

- Properties 5.2, 5.3, and 5.4 all test construction invariants of `HardwareWalletError`. They can be merged into a single comprehensive construction round-trip property.
- Properties 1.4, 2.4, and 6.5 all assert that underlying errors are wrapped as `HardwareWalletError` with the right code and cause. These cover different call sites but the same mapping invariant. They are kept separate because they test distinct code paths (connect, getPublicKey/signTransaction, transport factories).
- Properties 4.1 and 4.2 test different aspects of `signTransaction()` and cannot be collapsed.
- Properties 1.2 and 3.2 both assert G-address validity but from different perspectives (interface contract vs. concrete retrieval). They can be merged since 3.2 is more specific and subsumes 1.2 in the context of `LedgerWalletProvider`.

**Final properties after reflection:** 7 properties.


---

### Property 1: Public key is always a valid Stellar G-address

*For any* connected `LedgerWalletProvider` and any public key value returned by the mocked Ledger device, calling `getPublicKey()` must return a string that passes `StrKey.isValidEd25519PublicKey()`.

**Validates: Requirements 1.2, 3.2**

---

### Property 2: All WalletProvider method rejections are HardwareWalletError instances

*For any* error condition that causes `connect()`, `getPublicKey()`, or `signTransaction()` to reject (transport failure, device locked, app not open, user rejection, invalid input), the rejected value must be an instance of `HardwareWalletError`.

**Validates: Requirements 1.4**

---

### Property 3: TransportFactory rejection always maps to TRANSPORT_ERROR

*For any* error value thrown by the injected `TransportFactory`, calling `connect()` must throw a `HardwareWalletError` with `code === "TRANSPORT_ERROR"` and the original error set as `cause`.

**Validates: Requirements 2.4**

---

### Property 4: HardwareWalletError construction preserves code, message, and cause

*For any* valid `WalletErrorCode`, any non-empty message string, and any value passed as `cause`, constructing a `HardwareWalletError(code, message, { cause })` must produce an object where `.code === code`, `.message === message`, `.cause === cause`, and `instanceof Error === true`.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

---

### Property 5: Invalid XDR always throws INVALID_TRANSACTION

*For any* string that is not a valid base64-encoded Stellar transaction envelope (arbitrary strings, empty strings, partial base64, wrong XDR structure), calling `signTransaction(xdr)` after a successful `connect()` must throw a `HardwareWalletError` with `code === "INVALID_TRANSACTION"`.

**Validates: Requirements 4.6**

---

### Property 6: Valid XDR signing produces a transaction with the device signature attached

*For any* valid Stellar transaction encoded as an XDR envelope, when the mocked Ledger device returns a valid signature buffer, calling `signTransaction(xdr)` must return a `Transaction` whose `.signatures` array contains exactly one entry whose `signature` field equals the buffer returned by the device and whose `hint` matches the public key returned by `getPublicKey()`.

**Validates: Requirements 4.1, 4.2**

---

### Property 7: Transport factory failures always produce TRANSPORT_ERROR with cause

*For any* error thrown by the underlying `hw-transport-webusb` or `hw-transport-webhid` `create()` call, both `createWebUsbTransport` and `createWebHidTransport` must throw a `HardwareWalletError` with `code === "TRANSPORT_ERROR"` and the original error set as `cause`.

**Validates: Requirements 6.3, 6.4, 6.5**


## Error Handling

All errors that cross the `LedgerWalletProvider` API boundary are `HardwareWalletError`. The following table maps conditions to codes:

| Condition | Code |
|---|---|
| `TransportFactory` rejects | `TRANSPORT_ERROR` |
| `Str` (Stellar_App) constructor throws | `TRANSPORT_ERROR` |
| Any method called before `connect()` | `NOT_CONNECTED` |
| Device PIN screen / locked | `DEVICE_LOCKED` |
| User presses reject on device | `USER_REJECTED` |
| Stellar app not open on device | `APP_NOT_OPEN` |
| XDR argument fails `new Transaction()` | `INVALID_TRANSACTION` |
| Device disconnected mid-operation | `TRANSPORT_ERROR` |
| Any unrecognised SDK error | `TRANSPORT_ERROR` (fallback) |

The `mapSdkError()` helper (see Algorithms section) is the single place where Ledger SDK error message strings are inspected. If the Ledger SDK adds new status codes in a future version, only `mapSdkError()` needs updating.

### Error Propagation Flow

```
Ledger SDK throws
      │
      ▼
mapSdkError(err)
      │
      ├─ DEVICE_LOCKED
      ├─ USER_REJECTED
      ├─ APP_NOT_OPEN
      └─ TRANSPORT_ERROR (fallback)
      │
      ▼
HardwareWalletError { code, message, cause: original }
      │
      ▼
Consumer catch block
```


## Testing Strategy

### Dual-Layer Approach

The project uses Jest with `ts-jest` (see `jest.config.js`, `package.json`). Tests live in `tests/hardware/`.

**Unit tests** cover specific examples, state guards, and error code mappings:
- `connect()` with a resolving factory → `app` is set
- `connect()` with a rejecting factory → `TRANSPORT_ERROR`
- `getPublicKey()` before `connect()` → `NOT_CONNECTED`
- Each SDK error string → correct mapped `WalletErrorCode`
- `signTransaction()` with invalid XDR strings → `INVALID_TRANSACTION`
- `signTransaction()` with valid XDR → signature attached correctly (example-based)
- Browser API absence → `TRANSPORT_ERROR` from transport factories

**Property-based tests** cover universal invariants across generated inputs. The project will use [fast-check](https://github.com/dubzzz/fast-check), which works natively with Jest and TypeScript.

Each property test runs a minimum of **100 iterations**. Tests reference their corresponding design property via a comment:

```typescript
// Feature: hardware-wallet-interface, Property 1: Public key is always a valid Stellar G-address
```

### Property Test Plan

| Property | What's generated | What's asserted |
|---|---|---|
| P1: G-address validity | Random Stellar keypairs; mock device returns each public key | `StrKey.isValidEd25519PublicKey(result) === true` |
| P2: All rejections are HardwareWalletError | All error-triggering scenarios | `err instanceof HardwareWalletError` |
| P3: TransportFactory rejection → TRANSPORT_ERROR | Arbitrary `Error` instances and non-Error values | `err.code === "TRANSPORT_ERROR"` and `err.cause === original` |
| P4: HardwareWalletError construction round-trip | All 6 error codes × arbitrary strings × arbitrary cause values | `.code`, `.message`, `.cause` preserved; `instanceof Error` |
| P5: Invalid XDR → INVALID_TRANSACTION | Arbitrary strings (not valid XDR) | `err.code === "INVALID_TRANSACTION"` |
| P6: Sign produces attached signature | Random Transactions; arbitrary mock signature buffers | `tx.signatures` contains entry matching mock signature |
| P7: Transport factory failure → TRANSPORT_ERROR | Arbitrary errors from mock SDK `create()` | `err.code === "TRANSPORT_ERROR"` and `err.cause === original` |

### Mocking Strategy

`LedgerWalletProvider` tests mock:
- `TransportFactory` — a `jest.fn()` that resolves/rejects as needed
- `Str` from `@ledgerhq/hw-app-str` — mocked via `jest.mock()` to return controlled responses for `getPublicKey()` and `signTransaction()`

Transport factory tests mock:
- `navigator.usb` / `navigator.hid` — set/deleted on the global `navigator` object
- `@ledgerhq/hw-transport-webusb` / `@ledgerhq/hw-transport-webhid` — mocked to resolve or reject

All mocks are `jest.clearAllMocks()`-reset in `beforeEach`, matching the pattern in `tests/transaction.test.ts`.

### Usage Example (from Requirement 8)

The following example is included in `docs/quickstart.md` and covers all required documentation criteria:

```typescript
import {
  LedgerWalletProvider,
  HardwareWalletError,
  createWebUsbTransport,
  createWebHidTransport,
} from "stellar-wallet-helper";
import type { WalletProvider } from "stellar-wallet-helper";

// --- Option A: WebUSB ---
const usbProvider: WalletProvider = new LedgerWalletProvider(createWebUsbTransport);

// --- Option B: WebHID ---
const hidProvider: WalletProvider = new LedgerWalletProvider(createWebHidTransport);

async function signWithLedger(provider: WalletProvider, xdr: string) {
  try {
    await provider.connect();
    const publicKey = await provider.getPublicKey();
    console.log("Account:", publicKey);

    const signedTx = await provider.signTransaction(xdr);
    return signedTx;
  } catch (err) {
    if (err instanceof HardwareWalletError) {
      switch (err.code) {
        case "TRANSPORT_ERROR":
          console.error("Device not found or connection failed:", err.message);
          break;
        case "USER_REJECTED":
          console.warn("User rejected the transaction on the device.");
          break;
        case "APP_NOT_OPEN":
          console.error("Please open the Stellar app on your Ledger device.");
          break;
        default:
          console.error("Hardware wallet error:", err.code, err.message);
      }
    }
    throw err;
  }
}
```

