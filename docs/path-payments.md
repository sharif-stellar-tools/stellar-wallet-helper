# Path Payments with `stellar-wallet-helper`

Stellar lets you pay someone in an asset you don't hold by routing through the
decentralized exchange — a **path payment**. The `path-payment-utils` module
(`src/path-payment-utils.ts`) wraps Horizon's path-finding endpoints and adds
precise, floating-point-free helpers for the slippage bounds every path payment
requires.

There are two directions:

| Flavour            | You fix…                  | You must bound…                              | Horizon endpoint          |
| ------------------ | ------------------------- | -------------------------------------------- | ------------------------- |
| **strict-send**    | the amount you **send**   | `destMin` — the *minimum* the receiver gets  | `/paths/strict-send`      |
| **strict-receive** | the amount they **receive** | `sendMax` — the *maximum* you will spend    | `/paths/strict-receive` (a.k.a. `/paths`) |

All amounts are decimal strings with up to 7 decimal places (the Stellar
precision limit). Internally every calculation runs in **stroops** via `BigInt`,
so there is no floating-point drift.

---

## Quick reference

```js
const {
  PathPaymentManager,
  selectBestStrictSendPath,
  selectBestStrictReceivePath,
  calculateDestinationMin,
  calculateSendMax,
  isValidStellarAmount,
} = require('./dist/path-payment-utils'); // or '../src/path-payment-utils' in TS
```

| Function                                                       | Purpose                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `new PathPaymentManager(horizonUrl)`                          | Connect to a Horizon server.                                       |
| `.findStrictSendPaths(sourceAsset, sourceAmount, destination)`| Query `/paths/strict-send`.                                        |
| `.findStrictReceivePaths(source, destAsset, destAmount)`      | Query `/paths/strict-receive`.                                     |
| `selectBestStrictSendPath(records)`                           | Pick the path with the **highest** `destination_amount`.          |
| `selectBestStrictReceivePath(records)`                        | Pick the path with the **lowest** `source_amount`.                |
| `calculateDestinationMin(quotedDest, slippage)`               | Compute `destMin` (rounded **down**).                             |
| `calculateSendMax(quotedSource, slippage)`                    | Compute `sendMax` (rounded **up**).                              |
| `isValidStellarAmount(value)`                                 | Validate a positive ≤7-decimal amount string.                     |

`slippage` is a decimal fraction in `[0, 1)` — e.g. `0.01` is 1%.

---

## 1. Strict-send: "send exactly 100 XLM, receive USDC"

You want to spend exactly 100 XLM and have the recipient receive USDC. Find the
best path, then set a `destMin` floor so the payment fails if the market moves
against you by more than your tolerance.

```js
const { Asset, Operation } = require('@stellar/stellar-sdk');
const {
  PathPaymentManager,
  selectBestStrictSendPath,
  calculateDestinationMin,
} = require('./dist/path-payment-utils');

const USDC = new Asset(
  'USDC',
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
);

const manager = new PathPaymentManager('https://horizon.stellar.org');

(async () => {
  // 1. Ask Horizon what paths exist for sending exactly 100 XLM into USDC.
  const paths = await manager.findStrictSendPaths(
    Asset.native(), // sending XLM
    '100.0000000',  // exact send amount
    [USDC]          // candidate destination asset(s) — or a destination public key
  );

  // 2. Pick the path that gives the most USDC.
  const best = selectBestStrictSendPath(paths);
  if (!best) throw new Error('No path found');

  // 3. Protect against slippage: accept at least 99% of the quote.
  const destMin = calculateDestinationMin(best.destination_amount, 0.01);
  console.log(`Quote: ${best.destination_amount} USDC, destMin: ${destMin} USDC`);

  // 4. Build the operation.
  const op = Operation.pathPaymentStrictSend({
    sendAsset: Asset.native(),
    sendAmount: '100.0000000',
    destination: '<DESTINATION_PUBLIC_KEY>',
    destAsset: USDC,
    destMin,
    path: best.path.map(toAsset),
  });
  // ...add `op` to a TransactionBuilder, sign, and submit.
})();

function toAsset(a) {
  return a.asset_type === 'native'
    ? Asset.native()
    : new Asset(a.asset_code, a.asset_issuer);
}
```

---

## 2. Strict-receive: "make sure they get exactly 42 USDC"

You want the recipient to receive exactly 42 USDC and you'll pay in XLM. Find
the cheapest path, then set a `sendMax` ceiling so you never overspend beyond
your tolerance.

```js
const { Asset, Operation } = require('@stellar/stellar-sdk');
const {
  PathPaymentManager,
  selectBestStrictReceivePath,
  calculateSendMax,
} = require('./dist/path-payment-utils');

const USDC = new Asset(
  'USDC',
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
);

const manager = new PathPaymentManager('https://horizon.stellar.org');

(async () => {
  // 1. Ask Horizon what it would cost to deliver exactly 42 USDC.
  const paths = await manager.findStrictReceivePaths(
    [Asset.native()], // candidate source asset(s) — or your source public key
    USDC,             // asset the destination receives
    '42.0000000'      // exact receive amount
  );

  // 2. Pick the path that costs the least XLM.
  const best = selectBestStrictReceivePath(paths);
  if (!best) throw new Error('No path found');

  // 3. Protect against slippage: authorise up to 101% of the quote.
  const sendMax = calculateSendMax(best.source_amount, 0.01);
  console.log(`Quote: ${best.source_amount} XLM, sendMax: ${sendMax} XLM`);

  // 4. Build the operation.
  const op = Operation.pathPaymentStrictReceive({
    sendAsset: Asset.native(),
    sendMax,
    destination: '<DESTINATION_PUBLIC_KEY>',
    destAsset: USDC,
    destAmount: '42.0000000',
    path: best.path.map(toAsset),
  });
  // ...add `op` to a TransactionBuilder, sign, and submit.
})();

function toAsset(a) {
  return a.asset_type === 'native'
    ? Asset.native()
    : new Asset(a.asset_code, a.asset_issuer);
}
```

---

## Slippage math, precisely

The two helpers are deliberately asymmetric so the bound is always on the safe
side of the trade:

```js
calculateDestinationMin('100.0000000', 0.01); // '99.0000000'   (rounded down)
calculateSendMax('100.0000000', 0.01);        // '101.0000000'  (rounded up)

// Sub-stroop results are rounded conservatively, never toward your loss:
calculateDestinationMin('1.0000001', 0.005);  // '0.9950000'    (floor)
calculateSendMax('1.0000001', 0.005);         // '1.0050002'    (ceil)

// Zero slippage is a pass-through:
calculateDestinationMin('250.5000000', 0);    // '250.5000000'
```

Invalid input is rejected loudly with a `TypeError`:

```js
calculateDestinationMin('1.23456789', 0.01); // throws — more than 7 decimals
calculateSendMax('100', 1);                  // throws — slippage must be < 1
isValidStellarAmount('-5');                  // false
```

---

## See also

- `src/path-payment-utils.ts` — full JSDoc for every function.
- `tests/path-payment-utils.test.ts` — runnable examples of every helper.
- [Stellar docs: Path Payments](https://developers.stellar.org/docs/learn/encyclopedia/transactions-specialized/path-payments)
