# Quickstart: Scaffold a Hello World Soroban Contract

This guide takes you from zero to a deployed "Hello World" Soroban smart contract using **sharif-soroban-tools** and `stellar-wallet-helper`. By the end you will have:

- A funded Stellar keypair on the standalone (local) network
- A compiled WASM contract artifact
- A live deployed contract you can invoke

---

## Prerequisites

Make sure the following are installed before you begin.

| Tool | Version | Install |
|---|---|---|
| Node.js | 18 LTS or later | https://nodejs.org |
| Rust + Cargo | stable | `curl https://sh.rustup.rs -sSf \| sh` |
| Soroban CLI | latest | `cargo install --locked soroban-cli` |
| Docker | latest | https://docs.docker.com/get-docker/ |

Verify each one:

```bash
node --version
cargo --version
soroban --version
docker --version
```

---

## 1. Install stellar-wallet-helper

Clone the repository and install its Node dependencies:

```bash
git clone https://github.com/sharif-stellar-tools/stellar-wallet-helper.git
cd stellar-wallet-helper
npm install
```

Build the TypeScript source so the compiled output is available under `dist/`:

```bash
npm run build
```

---

## 2. Initialize a new Soroban project

Create a fresh Soroban contract project next to (or inside) the helper workspace:

```bash
soroban contract init hello-world
cd hello-world
```

This scaffolds the standard Cargo workspace layout:

```
hello-world/
├── Cargo.toml
└── contracts/
    └── hello-world/
        ├── Cargo.toml
        └── src/
            └── lib.rs
```

Replace the contents of `contracts/hello-world/src/lib.rs` with the classic Hello World contract:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
```

---

## 3. Generate a keypair with stellar-wallet-helper

Back in the `stellar-wallet-helper` directory, use `WalletManager` to create a new keypair for deploying the contract:

```js
// scripts/new-keypair.js
const { WalletManager } = require('./dist/wallet');

const keypair = WalletManager.createWallet();
console.log('Public key :', keypair.publicKey());
console.log('Secret key :', keypair.secret());
```

Run it:

```bash
node scripts/new-keypair.js
```

Save both values — you will need the secret key when deploying.

> **Note:** If you prefer a mnemonic-backed wallet (BIP-44), use `WalletManager.generateMnemonic()` and `WalletManager.fromMnemonic(mnemonic, 0)` instead.

---

## 4. Start the standalone network

Soroban ships a Docker image that runs a full local Stellar + Soroban network:

```bash
docker run --rm -it \
  -p 8000:8000 \
  --name stellar-standalone \
  stellar/quickstart:latest \
  --standalone \
  --enable-soroban-rpc
```

Leave this terminal open. The RPC endpoint will be available at `http://localhost:8000/soroban/rpc`.

---

## 5. Fund your account

The standalone network exposes a Friendbot at port 8000. Fund the public key you generated in step 3:

```bash
curl "http://localhost:8000/friendbot?addr=<YOUR_PUBLIC_KEY>"
```

Confirm the account exists:

```bash
soroban keys generate deployer --secret-key <YOUR_SECRET_KEY> --network standalone
soroban keys address deployer
```

Or configure the network once and reuse it:

```bash
soroban network add standalone \
  --rpc-url http://localhost:8000/soroban/rpc \
  --network-passphrase "Standalone Network ; February 2017"
```

---

## 6. Build the WASM file

From inside the `hello-world` project directory:

```bash
soroban contract build
```

The compiled artifact lands at:

```
target/wasm32-unknown-unknown/release/hello_world.wasm
```

You can inspect the contract interface before deploying:

```bash
soroban contract inspect \
  --wasm target/wasm32-unknown-unknown/release/hello_world.wasm
```

---

## 7. Deploy to the standalone network

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hello_world.wasm \
  --source deployer \
  --network standalone
```

On success the CLI prints the **contract ID**, a 64-character hex string. Copy it — you will use it in the next step.

```
CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 8. Invoke the contract

Call the `hello` function with an argument:

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network standalone \
  -- \
  hello \
  --to World
```

Expected output:

```json
["Hello", "World"]
```

---

## 9. Build and submit a payment (optional)

To send XLM between two accounts on the standalone network, use `TxManager` from `stellar-wallet-helper`:

```js
// scripts/send-payment.js
const { TxManager } = require('./dist/transaction');
const { WalletManager } = require('./dist/wallet');
const { Keypair, TransactionBuilder, Networks } = require('@stellar/stellar-sdk');

(async () => {
  const secret = '<YOUR_SECRET_KEY>';
  const dest   = '<DESTINATION_PUBLIC_KEY>';

  const manager = new TxManager('http://localhost:8000');
  const xdr     = await manager.buildPayment(
    Keypair.fromSecret(secret).publicKey(),
    dest,
    '10'               // amount in XLM
  );

  console.log('Signed XDR:', xdr);
})();
```

```bash
node scripts/send-payment.js
```

---

## Next steps

| Topic | Where to look |
|---|---|
| Path payments | [`docs/path-payments.md`](./path-payments.md) — `PathPaymentManager`, `calculateDestinationMin`, `calculateSendMax` |
| Multisig transactions | `src/multisig.ts` — `addSignerToTransaction`, `checkSignatureThreshold` |
| BIP-44 key derivation | `src/wallet.ts` — `WalletManager.fromMnemonic` |
| API routing | `src/api/router.ts` — `router.handle` |
| Test suite | `npm test` — runs all `.test.ts` files under `tests/` |
| Contributing | `CONTRIBUTING.md` |

For issues and feature requests, open a ticket at https://github.com/sharif-stellar-tools/stellar-wallet-helper/issues.
