# Implementation Plan: Hardware Wallet Interface

## Overview

Implement a device-agnostic hardware wallet layer for `stellar-wallet-helper` that starts with Ledger support via WebUSB/WebHID browser transports. The implementation follows an interface-first, injected transport factory pattern. All new source files live under `src/hardware/`, tests under `tests/hardware/`, and the feature is wired into the library's public entry point via `src/index.ts`.

## Tasks

- [ ] 1. Install dependencies and configure the project
  - Add `@ledgerhq/hw-app-str@^7.0.0`, `@ledgerhq/hw-transport-webusb@^6.29.0`, and `@ledgerhq/hw-transport-webhid@^6.29.0` to `dependencies` in `package.json`
  - Add `@ledgerhq/hw-transport@^6.31.0` to `devDependencies` in `package.json`
  - Add `fast-check@^3.0.0` to `devDependencies` in `package.json`
  - Run `npm install` to lock new entries into `package-lock.json`
  - _Requirements: 2.1, 6.1, 6.2_

- [ ] 2. Create `HardwareWalletError` — typed error class
  - [ ] 2.1 Implement `src/hardware/hardwareWalletError.ts`
    - Declare the `WalletErrorCode` union type covering all six codes: `"TRANSPORT_ERROR"`, `"NOT_CONNECTED"`, `"DEVICE_LOCKED"`, `"USER_REJECTED"`, `"APP_NOT_OPEN"`, `"INVALID_TRANSACTION"`
    - Implement `HardwareWalletError extends Error` with a `readonly code: WalletErrorCode` field
    - Pass `message` and `options` (carrying `cause`) to `super()` and set `this.name = "HardwareWalletError"`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.2 Write property test for `HardwareWalletError` construction (Property 4)
    - **Property 4: HardwareWalletError construction preserves code, message, and cause**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - Create `tests/hardware/hardwareWalletError.test.ts`
    - Use `fc.constantFrom(...codes)`, `fc.string({ minLength: 1 })`, and `fc.anything()` to generate all combinations
    - Assert `.code === code`, `.message === message`, `.cause === cause`, `instanceof Error === true`, `instanceof HardwareWalletError === true`, and `.name === "HardwareWalletError"`

- [ ] 3. Create `WalletProvider` interface and shared types
  - [ ] 3.1 Implement `src/hardware/walletProvider.ts`
    - Declare the `WalletProvider` interface with `connect(): Promise<void>`, `getPublicKey(): Promise<string>`, and `signTransaction(xdr: string): Promise<Transaction>` — no constructor signature
    - Import `Transaction` from `@stellar/stellar-sdk`
    - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.2_

  - [ ] 3.2 Implement `src/hardware/types.ts`
    - Declare `TransportFactory = () => Promise<Transport>` using `Transport` from `@ledgerhq/hw-transport`
    - Re-export `WalletProvider` type from `./walletProvider`
    - _Requirements: 2.1, 7.3_

- [ ] 4. Create browser transport factory functions
  - [ ] 4.1 Implement `src/hardware/transports.ts`
    - Implement `createWebUsbTransport(): Promise<Transport>`: check `navigator.usb` availability; if absent throw `HardwareWalletError("TRANSPORT_ERROR", ...)` before any SDK call; dynamically import `@ledgerhq/hw-transport-webusb` and call `.create()`; catch any SDK error and re-throw as `HardwareWalletError("TRANSPORT_ERROR", ..., { cause })`
    - Implement `createWebHidTransport(): Promise<Transport>`: identical shape using `navigator.hid` and `@ledgerhq/hw-transport-webhid`
    - Both functions must conform to `TransportFactory`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 4.2 Write property test for transport factory failures (Property 7)
    - **Property 7: Transport factory failures always produce TRANSPORT_ERROR with cause**
    - **Validates: Requirements 6.3, 6.4, 6.5**
    - Add to `tests/hardware/transports.test.ts`
    - Mock `@ledgerhq/hw-transport-webusb` and `@ledgerhq/hw-transport-webhid` to reject with arbitrary `fc.anything()` values
    - Assert thrown error `instanceof HardwareWalletError`, `.code === "TRANSPORT_ERROR"`, and `.cause` equals the mock rejection value
    - Also cover missing `navigator.usb` / `navigator.hid` via `delete` on the global `navigator` object

  - [ ]* 4.3 Write unit tests for transport factories
    - Add example-based tests to `tests/hardware/transports.test.ts`
    - Test: WebUSB succeeds when `navigator.usb` is present and SDK resolves
    - Test: WebUSB throws `TRANSPORT_ERROR` when `navigator.usb` is absent
    - Test: WebHID succeeds when `navigator.hid` is present and SDK resolves
    - Test: WebHID throws `TRANSPORT_ERROR` when `navigator.hid` is absent
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 5. Implement `LedgerWalletProvider`
  - [ ] 5.1 Implement `connect()` in `src/hardware/ledgerWalletProvider.ts`
    - Create `LedgerWalletProvider implements WalletProvider` with private fields `app: Str | null = null` and `publicKey: string | null = null`
    - Accept `private readonly transportFactory: TransportFactory` in the constructor
    - `connect()`: call `this.transportFactory()` inside a `try/catch`; on rejection throw `HardwareWalletError("TRANSPORT_ERROR", ..., { cause })`; then call `new Str(transport)` inside a second `try/catch`; on error throw `HardwareWalletError("TRANSPORT_ERROR", ..., { cause })`; set `this.app` on success
    - Define the constant `DERIVATION_PATH = "44'/148'/0'"` at module scope
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 5.2 Write property test for `connect()` transport rejection (Property 3)
    - **Property 3: TransportFactory rejection always maps to TRANSPORT_ERROR**
    - **Validates: Requirements 2.4**
    - Add to `tests/hardware/ledgerWalletProvider.test.ts`
    - Use `fc.anything()` as the rejection value for the mock `TransportFactory`
    - Assert the thrown error `instanceof HardwareWalletError`, `.code === "TRANSPORT_ERROR"`, and `.cause` equals the mock rejection value

  - [ ] 5.3 Implement `getPublicKey()` in `src/hardware/ledgerWalletProvider.ts`
    - Guard: if `this.app === null` throw `HardwareWalletError("NOT_CONNECTED", ...)`
    - Call `this.app.getPublicKey(DERIVATION_PATH)`; wrap any SDK error via `mapSdkError()`
    - Cache result in `this.publicKey`; return the G-address string
    - Implement the `mapSdkError(err: unknown): HardwareWalletError` helper function that inspects error message/status codes and maps to `DEVICE_LOCKED`, `USER_REJECTED`, `APP_NOT_OPEN`, or falls back to `TRANSPORT_ERROR`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.4 Write property test for `getPublicKey()` G-address validity (Property 1)
    - **Property 1: Public key is always a valid Stellar G-address**
    - **Validates: Requirements 1.2, 3.2**
    - Add to `tests/hardware/ledgerWalletProvider.test.ts`
    - Use `fc.constantFrom(...Keypair.random().publicKey(), ...)` or generate valid G-addresses via fast-check; mock device returns each as `getPublicKey()` result
    - Assert `StrKey.isValidEd25519PublicKey(result) === true` for every generated key

  - [ ] 5.5 Implement `signTransaction()` in `src/hardware/ledgerWalletProvider.ts`
    - Guard: if `this.app === null` throw `HardwareWalletError("NOT_CONNECTED", ...)`
    - Decode XDR: `try { new Transaction(xdrEnvelope, Networks.PUBLIC) }` — on error throw `HardwareWalletError("INVALID_TRANSACTION", ..., { cause })`; also accept `Networks.TESTNET` by trying both or using the passphrase from the envelope
    - Extract signing buffer via `tx.signatureBase()`
    - Call `this.app.signTransaction(DERIVATION_PATH, buffer)` inside a `try/catch`; wrap errors via `mapSdkError()`
    - Attach signature: `tx.addSignature(this.publicKey!, result.signature)`
    - Return the signed `Transaction`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 5.6 Write property test for invalid XDR (Property 5)
    - **Property 5: Invalid XDR always throws INVALID_TRANSACTION**
    - **Validates: Requirements 4.6**
    - Add to `tests/hardware/ledgerWalletProvider.test.ts`
    - Use `fc.string()`, `fc.base64String()` (not valid XDR), and `fc.constant("")` as input generators
    - After a successful mock `connect()`, call `signTransaction(arbitraryString)` and assert thrown error `.code === "INVALID_TRANSACTION"`

  - [ ]* 5.7 Write property test for valid XDR signing (Property 6)
    - **Property 6: Valid XDR signing produces a transaction with the device signature attached**
    - **Validates: Requirements 4.1, 4.2**
    - Add to `tests/hardware/ledgerWalletProvider.test.ts`
    - Use `fc.uint8Array({ minLength: 64, maxLength: 64 })` for mock signature buffers; build real XDR test fixtures using `@stellar/stellar-sdk`
    - Assert the returned `Transaction.signatures` array contains exactly one entry whose `signature` field equals the mock buffer returned by the device

  - [ ]* 5.8 Write property test for all rejections being HardwareWalletError (Property 2)
    - **Property 2: All WalletProvider method rejections are HardwareWalletError instances**
    - **Validates: Requirements 1.4**
    - Add to `tests/hardware/ledgerWalletProvider.test.ts`
    - Generate error conditions across `connect()`, `getPublicKey()`, and `signTransaction()` using `fc.oneof` of all error-triggering scenarios
    - Assert each rejection `instanceof HardwareWalletError`

  - [ ]* 5.9 Write unit tests for `LedgerWalletProvider`
    - Add example-based tests to `tests/hardware/ledgerWalletProvider.test.ts`
    - Test: `connect()` with resolving factory sets internal app state
    - Test: `connect()` with rejecting factory throws `TRANSPORT_ERROR`
    - Test: `getPublicKey()` before `connect()` throws `NOT_CONNECTED`
    - Test: `getPublicKey()` after `connect()` returns a G-address matching `^G[A-Z2-7]{55}$`
    - Test: each SDK error string (`"locked"`, `"0x5515"`, `"denied"`, `"0x6985"`, `"not open"`, `"0x6e00"`) maps to the correct `WalletErrorCode`
    - Test: `signTransaction()` before `connect()` throws `NOT_CONNECTED`
    - Test: `signTransaction()` with empty string throws `INVALID_TRANSACTION`
    - Test: `signTransaction()` with valid XDR and mock device returns `Transaction` with signature attached
    - _Requirements: 2.1–2.5, 3.1–3.5, 4.1–4.7_

- [ ] 6. Checkpoint — core implementation complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Create the `src/hardware` barrel and update public exports
  - [ ] 7.1 Create `src/hardware/index.ts` barrel
    - Export `WalletProvider` type from `./walletProvider`
    - Export `TransportFactory` type from `./types`
    - Export `HardwareWalletError` class and `WalletErrorCode` type from `./hardwareWalletError`
    - Export `LedgerWalletProvider` class from `./ledgerWalletProvider`
    - Export `createWebUsbTransport` and `createWebHidTransport` from `./transports`
    - _Requirements: 1.5, 5.6, 7.3_

  - [ ] 7.2 Create `src/index.ts` as the TypeScript public entry point
    - Export `WalletManager` from `./wallet`
    - Export `TxManager` from `./transaction`
    - Export `addSignerToTransaction` and `checkSignatureThreshold` from `./multisig`
    - Export `WalletProvider`, `TransportFactory`, `WalletErrorCode` types from `./hardware`
    - Export `HardwareWalletError`, `LedgerWalletProvider`, `createWebUsbTransport`, `createWebHidTransport` from `./hardware`
    - _Requirements: 1.5, 5.6, 7.3_

  - [ ]* 7.3 Write unit tests verifying public API surface
    - Add `tests/hardware/exports.test.ts`
    - Import each named export from the barrel `src/hardware/index.ts` and assert it is defined
    - Verify `HardwareWalletError` is constructable and `instanceof Error`
    - Verify `LedgerWalletProvider` is a constructor that accepts a `TransportFactory`
    - _Requirements: 1.5, 5.6_

- [ ] 8. Update `docs/quickstart.md` with hardware wallet usage example
  - Append a new `## Hardware Wallet (Ledger)` section to `docs/quickstart.md`
  - Include two labeled TypeScript code blocks — one using `createWebUsbTransport` and one using `createWebHidTransport` — both typed as `WalletProvider`
  - Include a `catch` block branching on `HardwareWalletError.code` with named cases for `"TRANSPORT_ERROR"`, `"USER_REJECTED"`, and `"APP_NOT_OPEN"`
  - The example must be self-contained and compilable (use imports from `"stellar-wallet-helper"`)
  - Update the "Next steps" table in `docs/quickstart.md` to include a row for hardware wallet signing
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 9. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they are property-based or unit tests
- The `HardwareWalletError` class (task 2) must exist before `LedgerWalletProvider` (task 5) because the provider imports it at the top of the file
- The `WalletProvider` interface and `types.ts` (task 3) must exist before `LedgerWalletProvider` (task 5) so the `implements` clause and `TransportFactory` type resolve correctly
- `transports.ts` (task 4) can be authored in parallel with `LedgerWalletProvider` (task 5) since they share no runtime dependency
- The barrel `src/hardware/index.ts` and `src/index.ts` (task 7) must be authored after all implementation files in tasks 2–5 are complete, as they re-export those modules
- All property tests use `fast-check` with a minimum of 100 iterations; annotate each test with the property number (e.g., `// Property 4`)
- `jest.clearAllMocks()` should be called in `beforeEach` across all test files, matching the project pattern
- XDR decoding in `signTransaction()` should try `Networks.PUBLIC` first, then `Networks.TESTNET`; if both fail, the outer catch maps to `INVALID_TRANSACTION`
- Dynamic imports in `transports.ts` keep `hw-transport-webusb` and `hw-transport-webhid` tree-shakeable in browser builds

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1", "3.2"] },
    { "id": 2, "tasks": ["4.1", "5.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.2", "5.3"] },
    { "id": 4, "tasks": ["5.4", "5.5"] },
    { "id": 5, "tasks": ["5.6", "5.7", "5.8", "5.9"] },
    { "id": 6, "tasks": ["7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3"] }
  ]
}
```
