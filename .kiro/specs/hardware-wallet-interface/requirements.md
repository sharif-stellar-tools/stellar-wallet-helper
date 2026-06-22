# Requirements Document

## Introduction

This feature introduces a unified hardware wallet interface to the `stellar-wallet-helper` library. It provides a secure, abstracted mechanism for connecting to hardware wallets (starting with Ledger) and signing arbitrary Stellar transactions via WebUSB or WebHID browser transport layers, without tightly coupling device-specific logic to the consuming UI or application code.

The design follows an interface-first approach so additional hardware wallet providers (e.g., Trezor) can be integrated in the future with no changes to application code.

## Glossary

- **WalletProvider**: The generic interface (or abstract base class) that all hardware wallet implementations must satisfy, exposing `connect()`, `getPublicKey()`, and `signTransaction()`.
- **LedgerWalletProvider**: The concrete `WalletProvider` implementation that communicates with a Ledger hardware device via the `@ledgerhq/hw-app-str` library.
- **Transport**: The low-level browser communication channel between the host page and the hardware device — either WebUSB (`@ledgerhq/hw-transport-webusb`) or WebHID (`@ledgerhq/hw-transport-webhid`).
- **TransportFactory**: A zero-argument callable `() => Promise<Transport>` used to inject the transport layer into `LedgerWalletProvider`.
- **Stellar_App**: The Ledger application running on the device that understands Stellar transactions; accessed via `@ledgerhq/hw-app-str`.
- **Derivation_Path**: The BIP-44 hierarchical deterministic path used to derive the Stellar account key on the device: `44'/148'/0'`.
- **XDR_Envelope**: A base64-encoded XDR transaction envelope string, as produced by `Transaction.toXDR()` in `@stellar/stellar-sdk`, which is the serialized form passed to `signTransaction()`.
- **Signed_Transaction**: A `Transaction` object from `@stellar/stellar-sdk` with the hardware wallet's signature attached and ready for submission to Horizon.
- **HardwareWalletError**: A typed error class that wraps all hardware-wallet-specific failures with a discriminated `code` field.

---

## Requirements

### Requirement 1: Generic WalletProvider Interface

**User Story:** As a library consumer, I want a stable, device-agnostic interface for hardware wallet operations, so that my application code does not need to change when a new hardware wallet is supported.

#### Acceptance Criteria

1. THE `WalletProvider` SHALL declare a `connect()` method that returns `Promise<void>`.
2. THE `WalletProvider` SHALL declare a `getPublicKey()` method that returns `Promise<string>`, where the returned string must pass `StrKey.isValidEd25519PublicKey()` from `@stellar/stellar-sdk` (i.e., a valid Stellar G-address).
3. THE `WalletProvider` SHALL declare a `signTransaction(xdr: string)` method that accepts a base64-encoded XDR transaction envelope and returns `Promise<Signed_Transaction>`, where `Signed_Transaction` is a `Transaction` object from `@stellar/stellar-sdk` with the hardware wallet's signature attached.
4. ALL rejections from `WalletProvider` methods SHALL use `HardwareWalletError`; throwing a plain `Error` or any other error type does not satisfy this interface contract.
5. THE `WalletProvider` SHALL be exported from the library's public entry point so consumers can use it as a type annotation.

---

### Requirement 2: LedgerWalletProvider — Transport Instantiation

**User Story:** As a library consumer, I want the Ledger provider to accept an injected transport factory, so that I can choose between WebUSB and WebHID without changing the provider class.

#### Acceptance Criteria

1. THE `LedgerWalletProvider` SHALL accept a `TransportFactory` (a zero-argument callable returning `Promise<Transport>`) as a constructor parameter.
2. WHEN `connect()` is called, THE `LedgerWalletProvider` SHALL invoke the `TransportFactory` to obtain a `Transport` instance.
3. WHEN `connect()` is called and the `TransportFactory` resolves successfully, THE `LedgerWalletProvider` SHALL instantiate `Stellar_App` using the acquired `Transport`.
4. IF `connect()` is called and the `TransportFactory` rejects for any reason, THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "TRANSPORT_ERROR"`, the provider SHALL remain in an unconnected state, and `connect()` MAY be retried.
5. IF `connect()` is called and `Stellar_App` instantiation fails after the `TransportFactory` resolves, THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "TRANSPORT_ERROR"` and the provider SHALL remain in an unconnected state.

---

### Requirement 3: LedgerWalletProvider — Public Key Retrieval

**User Story:** As a library consumer, I want to fetch the user's Stellar public key from the connected Ledger device using the standard derivation path, so that I can construct and display the account to the user.

#### Acceptance Criteria

1. WHEN `getPublicKey()` is called after a successful `connect()`, THE `LedgerWalletProvider` SHALL retrieve the public key from `Stellar_App` using `Derivation_Path` `44'/148'/0'`.
2. WHEN `getPublicKey()` is called and the device returns a valid key, THE `LedgerWalletProvider` SHALL return the key as a Stellar G-address string matching the pattern `^G[A-Z2-7]{55}$`.
3. IF `getPublicKey()` is called before `connect()` has been successfully invoked, THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "NOT_CONNECTED"`.
4. IF the device is locked during `getPublicKey()`, THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "DEVICE_LOCKED"`.
5. IF the Stellar app is not open on the device during `getPublicKey()`, THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "APP_NOT_OPEN"`.

---

### Requirement 4: LedgerWalletProvider — Transaction Signing

**User Story:** As a library consumer, I want to sign an arbitrary Stellar transaction with the user's Ledger device, so that the signed transaction can be submitted to the Stellar network without the private key ever leaving the hardware device.

#### Acceptance Criteria

1. WHEN `signTransaction(xdr)` is called with a valid `XDR_Envelope` after a successful `connect()`, THE `LedgerWalletProvider` SHALL decode the `XDR_Envelope` into a `Transaction` object and pass its raw XDR buffer to `Stellar_App` for signing.
2. WHEN the device returns a valid signature, THE `LedgerWalletProvider` SHALL attach the signature to the transaction by calling `Transaction.addSignature()` with both the signature and the public key corresponding to the active `Derivation_Path`, then return the resulting `Signed_Transaction`.
3. IF the user rejects the signature on the device, THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "USER_REJECTED"`.
4. IF the `Stellar_App` is not open on the device during signing, THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "APP_NOT_OPEN"`.
5. IF `signTransaction()` is called before `connect()` has been successfully invoked, THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "NOT_CONNECTED"`.
6. IF the `xdr` argument is not a valid base64-encoded Stellar XDR transaction envelope, THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "INVALID_TRANSACTION"`.
7. IF the device communication fails or times out during signing (e.g., device unplugged mid-operation), THEN THE `LedgerWalletProvider` SHALL throw a `HardwareWalletError` with `code: "TRANSPORT_ERROR"`.

---

### Requirement 5: Error Handling — HardwareWalletError

**User Story:** As a library consumer, I want all hardware wallet failures exposed as a single, typed error class with a discriminated code, so that I can handle specific error cases predictably in my application.

#### Acceptance Criteria

1. THE `HardwareWalletError` SHALL extend the native `Error` class.
2. THE `HardwareWalletError` SHALL expose a `code` property typed as one of: `"TRANSPORT_ERROR"`, `"NOT_CONNECTED"`, `"DEVICE_LOCKED"`, `"USER_REJECTED"`, `"APP_NOT_OPEN"`, `"INVALID_TRANSACTION"`.
3. THE `HardwareWalletError` SHALL expose a non-empty `message` string property.
4. IF the underlying Ledger transport or app SDK throws an error across any public method of `LedgerWalletProvider`, THEN THE `LedgerWalletProvider` SHALL wrap it in a `HardwareWalletError` preserving the original error as the `cause` property.
5. IF an SDK error cannot be mapped to a known `code`, THEN THE `LedgerWalletProvider` SHALL use `code: "TRANSPORT_ERROR"` as the fallback, preserving the original error as `cause`.
6. THE `HardwareWalletError` SHALL be exported from the library's public entry point so consumers can use `instanceof` checks.

---

### Requirement 6: Browser Transport Selection

**User Story:** As a library consumer, I want to choose between WebUSB and WebHID transport at the call site, so that I can adapt to the target browser's supported APIs without forking logic inside the provider.

#### Acceptance Criteria

1. THE library SHALL export a `createWebUsbTransport` factory function that wraps `@ledgerhq/hw-transport-webusb` and conforms to the `TransportFactory` type, returning `Promise<Transport>` on success.
2. THE library SHALL export a `createWebHidTransport` factory function that wraps `@ledgerhq/hw-transport-webhid` and conforms to the `TransportFactory` type, returning `Promise<Transport>` on success.
3. IF the browser does not support the WebUSB API and `createWebUsbTransport` is called, THEN `createWebUsbTransport` SHALL throw a `HardwareWalletError` with `code: "TRANSPORT_ERROR"`.
4. IF the browser does not support the WebHID API and `createWebHidTransport` is called, THEN `createWebHidTransport` SHALL throw a `HardwareWalletError` with `code: "TRANSPORT_ERROR"`.
5. IF the transport-open operation fails at runtime (e.g., permission denied, no device found) for either factory, THEN the factory SHALL throw a `HardwareWalletError` with `code: "TRANSPORT_ERROR"`, preserving the original error as `cause` per Requirement 5 criterion 4.

---

### Requirement 7: Extensibility — Future Hardware Wallet Providers

**User Story:** As a library maintainer, I want the architecture to support adding new hardware wallet providers, so that future devices (e.g., Trezor) can be integrated without modifying existing code.

#### Acceptance Criteria

1. THE `WalletProvider` interface SHALL serve as the sole contract for future provider implementations, defined entirely by the three methods `connect()`, `getPublicKey()`, and `signTransaction()` — no additional base classes or registration steps required.
2. THE `WalletProvider` interface SHALL NOT declare a constructor signature, so that future providers may use any construction parameters without violating the interface.
3. All exported functions and type aliases in the library's public API SHALL declare `WalletProvider` (not `LedgerWalletProvider`) as the parameter or return type wherever a hardware wallet provider is referenced, so that no consuming code is concretely coupled to `LedgerWalletProvider`.

---

### Requirement 8: Usage Example

**User Story:** As a library consumer, I want a documented usage example showing how to instantiate `LedgerWalletProvider` and sign a transaction, so that I can integrate the feature quickly.

#### Acceptance Criteria

1. THE library documentation SHALL include a self-contained, compilable TypeScript code example demonstrating how a UI component instantiates `LedgerWalletProvider` with a `TransportFactory`, calls `connect()`, calls `getPublicKey()`, and calls `signTransaction()`.
2. THE code example SHALL contain two distinct, labeled code blocks — one using `createWebUsbTransport` and one using `createWebHidTransport`.
3. THE code example SHALL demonstrate a `catch` block that branches on the `HardwareWalletError.code` property, with named branches for at least `"TRANSPORT_ERROR"`, `"USER_REJECTED"`, and `"APP_NOT_OPEN"`.
