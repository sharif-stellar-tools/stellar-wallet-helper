# Hardware Wallet Integration Guide (Ledger Nano via WebHID)

This guide details how to integrate hardware wallet connection flows and transaction signing using `stellar-wallet-helper` and Ledger Nano in modern browser applications and React dApps.

---

## 🚀 Overview

The `LedgerSigner` and `WebHidTransport` classes provide secure, non-custodial transaction signing directly through browser-supported WebHID. Private keys never leave the hardware device; only the transaction signature and public key are communicated.

### Supported Transports
- **WebHID** (`WebHidTransport`): Recommended for modern desktop browsers (Chrome, Edge, Brave, Opera).
- **WebUSB** (`WebUsbTransport`): Fallback for environments with WebUSB permission models.
- **WebBluetooth** (`WebBleTransport`): For wireless Ledger Nano X connections on supported platforms.

---

## 🛠️ Step-by-Step React Integration Example

Below is a complete, production-ready React component showing how to initialize WebHID transport, fetch the Stellar public key from Ledger, and sign a transaction envelope.

```tsx
import React, { useState } from 'react';
import {
  LedgerTransportFactory,
  LedgerSigner,
  TransportType,
  DeviceNotConnectedError,
  UserRejectedError,
} from '@sharif-stellar-tools/stellar-wallet-helper';
import { Transaction } from '@stellar/stellar-sdk';

export const LedgerConnect: React.FC = () => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Idle');
  const [isSigning, setIsSigning] = useState<boolean>(false);

  // 1. Initialize WebHID Transport and Connect to Ledger
  const handleConnect = async () => {
    try {
      setStatus('Prompting WebHID permission... Please select your Ledger device.');
      
      // Request WebHID device access from browser
      const transport = await LedgerTransportFactory.create(TransportType.WebHID);
      const signer = new LedgerSigner(transport);

      setStatus('Connecting to Stellar App on Ledger...');
      // BIP-44 path for Stellar (44'/148'/0')
      const address = await signer.getPublicKey("44'/148'/0'");
      
      setPublicKey(address);
      setStatus('Connected successfully!');
    } catch (err: any) {
      if (err instanceof DeviceNotConnectedError) {
        setStatus('Error: Device not connected. Please unlock your Ledger and open the Stellar app.');
      } else if (err instanceof UserRejectedError) {
        setStatus('Action cancelled by user.');
      } else {
        setStatus(`Connection failed: ${err.message}`);
      }
    }
  };

  // 2. Sign a Stellar Transaction Envelope
  const handleSignTransaction = async (txEnvelopeXdr: string) => {
    if (!publicKey) return;

    try {
      setIsSigning(true);
      setStatus('Please review and confirm transaction on Ledger device display...');

      const transport = await LedgerTransportFactory.create(TransportType.WebHID);
      const signer = new LedgerSigner(transport);

      // Sign transaction using BIP-44 path
      const signedXdr = await signer.signTransaction("44'/148'/0'", txEnvelopeXdr);

      setStatus('Transaction successfully signed!');
      return signedXdr;
    } catch (err: any) {
      if (err instanceof UserRejectedError) {
        setStatus('Transaction rejected on Ledger device.');
      } else {
        setStatus(`Signing failed: ${err.message}`);
      }
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="ledger-card p-6 border rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">Ledger Hardware Wallet Connection</h2>
      
      {!publicKey ? (
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
        >
          Connect Ledger (WebHID)
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-mono bg-gray-100 p-2 rounded break-all">
            Connected: {publicKey}
          </p>
          <button
            disabled={isSigning}
            onClick={() => handleSignTransaction('AAAA...SAMPLE_XDR...')}
            className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isSigning ? 'Confirm on Device...' : 'Sign Sample Transaction'}
          </button>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        Status: <span className="font-semibold">{status}</span>
      </div>
    </div>
  );
};
```

---

## 🔒 Security Best Practices for Hardware Wallets

1. **Verify Hash and Destination on Device Display**:
   Always prompt users to inspect the operation details, destination address, and sequence numbers directly on the physical Ledger screen before pressing both buttons.
2. **Handle User Cancellation Gracefully**:
   Listen for `UserRejectedError` to reset UI state without showing fatal error alerts when a user declines signing.
3. **Handle USB Disconnect / App Sleep**:
   Hardware wallets lock automatically when idle. When `DeviceNotConnectedError` occurs, instruct users to enter their PIN and reopen the Stellar app.
4. **Use Standard BIP-44 Derivation Paths**:
   Default account path: `44'/148'/0'` (Stellar coin type `148'`). For sub-accounts, increment the account index (e.g., `44'/148'/1'`).
