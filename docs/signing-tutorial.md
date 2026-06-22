# How to sign a Stellar transaction with stellar-wallet-helper

This project gives you the primitives you need to work with Stellar wallets and transactions.
The flow below uses only the public SDK types plus the helpers in this repo.

## 1) Create a keypair

```ts
import { WalletManager } from '../src/wallet';

// In real usage, this usually comes from your app config or environment.
const source = WalletManager.fromSecret(process.env.SOURCE_SECRET!);
```

You can also create a fresh keypair for local testing:

```ts
const randomKeypair = WalletManager.createWallet();
```

## 2) Build a payment transaction

```ts
import {
  Account,
  Asset,
  TransactionBuilder,
  Networks,
  Operation,
} from '@stellar/stellar-sdk';

const sourcePublicKey = source.publicKey();
const destination = 'GDUMMY...'; // replace with a real destination public key

const sourceAccount = new Account(sourcePublicKey, '0');

const transaction = new TransactionBuilder(sourceAccount, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({
      destination,
      asset: Asset.native(),
      amount: '10',
    })
  )
  .setTimeout(30)
  .build();
```

## 3) Sign the transaction

```ts
// Primary signature from source account
transaction.sign(source);
```

For multi-signature flows, the helper in `src/multisig.ts` lets you add extra signers:

```ts
import { addSignerToTransaction } from '../src/multisig';

const cosigner = WalletManager.createWallet();
addSignerToTransaction(transaction, cosigner);
```

You can verify signature threshold logic with:

```ts
import { checkSignatureThreshold } from '../src/multisig';

const hasEnoughSignatures = checkSignatureThreshold(transaction, 2);
```

## 4) Submit (example shape)

The current helper project includes transaction construction and signing primitives.
Submission typically happens through your Stellar RPC/SDK submission path (not yet wrapped by this package in this sample).

```ts
// Example only: replace with your own submit layer.
// await server.submitTransaction(transaction);
```

## 5) Common gotchas

- Ensure network passphrase matches your target network (`TESTNET` vs `PUBLIC`).
- Keep `Account` sequence and timeout values current.
- For real app flows, store secrets outside source code and load from env/secret manager.
