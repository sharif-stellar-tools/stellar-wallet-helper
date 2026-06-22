/**
 * Shamir's Secret Sharing over GF(2^8)
 */

const PRIMITIVE_POLYNOMIAL = 0x11d; // x^8 + x^4 + x^3 + x^2 + 1

const gf_exp = new Uint8Array(512);
const gf_log = new Uint8Array(256);

function init_tables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gf_exp[i] = x;
    gf_log[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= PRIMITIVE_POLYNOMIAL;
    }
  }
  for (let i = 255; i < 512; i++) {
    gf_exp[i] = gf_exp[i - 255];
  }
}

init_tables();

function add(a: number, b: number): number {
  return a ^ b;
}

function sub(a: number, b: number): number {
  return a ^ b;
}

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return gf_exp[gf_log[a] + gf_log[b]];
}

function div(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero in GF(2^8)");
  if (a === 0) return 0;
  return gf_exp[gf_log[a] + 255 - gf_log[b]];
}

function eval_poly(poly: Uint8Array, x: number): number {
  let result = 0;
  for (let i = poly.length - 1; i >= 0; i--) {
    result = add(mul(result, x), poly[i]);
  }
  return result;
}

/**
 * Splits a secret into N shares, requiring T shares to reconstruct.
 *
 * @param secret - The secret as a Uint8Array.
 * @param threshold - The minimum number of shares needed to reconstruct (T).
 * @param numShares - The total number of shares to generate (N).
 * @returns An array of shares, where each share is a Uint8Array [x, y1, y2, ...].
 */
export function split(
  secret: Uint8Array,
  threshold: number,
  numShares: number
): Uint8Array[] {
  if (threshold < 1 || threshold > numShares || numShares > 255) {
    throw new Error("Invalid threshold or number of shares");
  }

  const shares: Uint8Array[] = [];
  for (let i = 0; i < numShares; i++) {
    const share = new Uint8Array(secret.length + 1);
    share[0] = i + 1; // x coordinate
    shares.push(share);
  }

  for (let i = 0; i < secret.length; i++) {
    const poly = new Uint8Array(threshold);
    poly[0] = secret[i];
    for (let j = 1; j < threshold; j++) {
      poly[j] = Math.floor(Math.random() * 256);
    }

    for (let j = 0; j < numShares; j++) {
      shares[j][i + 1] = eval_poly(poly, shares[j][0]);
    }
  }

  return shares;
}

/**
 * Reconstructs a secret from a set of shares.
 *
 * @param shares - An array of shares, where each share is a Uint8Array [x, y1, y2, ...].
 * @returns The reconstructed secret as a Uint8Array.
 */
export function combine(shares: Uint8Array[]): Uint8Array {
  if (shares.length === 0) throw new Error("No shares provided");

  const secretLen = shares[0].length - 1;
  const secret = new Uint8Array(secretLen);

  for (let i = 0; i < secretLen; i++) {
    let result = 0;
    for (let j = 0; j < shares.length; j++) {
      const xj = shares[j][0];
      const yj = shares[j][i + 1];

      let weight = 1;
      for (let k = 0; k < shares.length; k++) {
        if (j === k) continue;
        const xk = shares[k][0];
        weight = mul(weight, div(xk, sub(xk, xj)));
      }
      result = add(result, mul(yj, weight));
    }
    secret[i] = result;
  }

  return secret;
}
