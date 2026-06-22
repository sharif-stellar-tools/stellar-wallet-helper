import { split, combine } from "../src/utils/sss";

describe("Shamir's Secret Sharing", () => {
  test("should split and combine a secret", () => {
    const secret = new TextEncoder().encode("hello world");
    const threshold = 3;
    const numShares = 5;

    const shares = split(secret, threshold, numShares);
    expect(shares.length).toBe(numShares);

    const reconstructed = combine(shares.slice(0, threshold));
    expect(new TextDecoder().decode(reconstructed)).toBe("hello world");
  });

  test("should fail with fewer than threshold shares", () => {
    const secret = new TextEncoder().encode("hello world");
    const threshold = 3;
    const numShares = 5;

    const shares = split(secret, threshold, numShares);
    const reconstructed = combine(shares.slice(0, threshold - 1));
    expect(new TextDecoder().decode(reconstructed)).not.toBe("hello world");
  });

  test("should work with different threshold and numShares", () => {
    const secret = new TextEncoder().encode("top secret message");
    const threshold = 2;
    const numShares = 3;

    const shares = split(secret, threshold, numShares);
    const reconstructed = combine([shares[0], shares[2]]);
    expect(new TextDecoder().decode(reconstructed)).toBe("top secret message");
  });

  test("should work with 1-of-1", () => {
    const secret = new TextEncoder().encode("only me");
    const threshold = 1;
    const numShares = 1;

    const shares = split(secret, threshold, numShares);
    const reconstructed = combine(shares);
    expect(new TextDecoder().decode(reconstructed)).toBe("only me");
  });

  test("should throw error for invalid parameters", () => {
    const secret = new Uint8Array([1, 2, 3]);
    expect(() => split(secret, 0, 5)).toThrow();
    expect(() => split(secret, 6, 5)).toThrow();
    expect(() => split(secret, 2, 256)).toThrow();
  });
});
