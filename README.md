<div align="center">
  <h1>stellar-wallet-helper</h1>
  <p><strong>Enterprise-grade wallet integration toolkit and key management suite for Stellar.</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Stellar](https://img.shields.io/badge/Stellar-Wallet%20Helper-blue)](https://stellar.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org)
</div>

<br />

## 📖 Overview

`stellar-wallet-helper` is an enterprise client library providing non-custodial key management, hardware wallet signing (Ledger Nano via WebHID), policy-enforced automated transaction signers, **SEP-23 (Stellar Turrets)** decentralized execution, and automatic sequence/fee session management.

It eliminates repetitive wallet connection and transaction envelope boilerplate for web3 dApps, mobile wallets, and backend automated services.

---

## ✨ Key Capabilities

- **Stellar Turrets (SEP-23)**: Non-custodial, decentralized multi-sig automation for scheduled and conditional transactions.
- **Signing Policy Engine**: Programmable rule evaluation (`maxAmount`, `allowedDestinations`, `allowedOperations`, `timeWindow`) before private key access.
- **Hardware Wallet Integration**: Direct browser-based Ledger Nano signing via `@ledgerhq/hw-transport-webhid`.
- **`WalletSession` Manager**: State encapsulation that automatically handles account sequence numbers, fee caching, and stale sequence recovery.
- **Property-Based Cryptographic Testing**: Exhaustive verification of key derivation (BIP-39/BIP-44/SEP-0005) using `fast-check`.

---

## 💡 Code Examples

### 1. `WalletSession` Managed Transaction Building

```typescript
import { WalletSession } from '@sharif-stellar-tools/stellar-wallet-helper';

// Initialize session with public key and Horizon URL
const session = await WalletSession.load('GB...PUBLIC_KEY', 'https://horizon-testnet.stellar.org');

// Automatically fills sequence number, base fee, and network passphrase
const tx = session.buildTransaction([
  // ... operations
]);
```

### 2. Signing Policy Enforcement

```typescript
import { SigningPolicyEngine, MaxAmountRule } from '@sharif-stellar-tools/stellar-wallet-helper';

const policy = new SigningPolicyEngine([
  new MaxAmountRule({ maxStroops: '50000000' }), // Max 5 XLM per tx
]);

// Throws PolicyViolationError if transaction exceeds rules before accessing keys
await policy.validateAndSign(transaction, secretKey);
```

---

## 🧪 Installation & Testing

```bash
# Install package
npm install @sharif-stellar-tools/stellar-wallet-helper

# Run tests
npm test

# Run property-based tests (1000+ randomized iterations)
npm run test:property
```

---

## 🛣️ Roadmap & Active GitHub Issues

- [[Feature] Implement Stellar Turrets (SEP-23) integration for non-custodial automation](https://github.com/sharif-stellar-tools/stellar-wallet-helper/issues/1)
- [[Security] Add transaction signing policy engine with configurable rules](https://github.com/sharif-stellar-tools/stellar-wallet-helper/issues/2)
- [[Feature] Add Ledger Nano hardware wallet signing support via HID transport](https://github.com/sharif-stellar-tools/stellar-wallet-helper/issues/3)
- [[DX] Build a WalletSession class to manage account state, sequence numbers, and fee caching](https://github.com/sharif-stellar-tools/stellar-wallet-helper/issues/4)
- [[Testing] Add property-based testing for key derivation and signing correctness](https://github.com/sharif-stellar-tools/stellar-wallet-helper/issues/5)

---

## 📄 License

Licensed under the MIT License. See [LICENSE](./LICENSE) for details.
