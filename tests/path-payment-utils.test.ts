import { Asset, Horizon } from "@stellar/stellar-sdk";
import {
  PathPaymentManager,
  PaymentPathRecord,
  selectBestStrictSendPath,
  selectBestStrictReceivePath,
  calculateDestinationMin,
  calculateSendMax,
  isValidStellarAmount,
  amountToStroops,
} from "../src/path-payment-utils";

const mockStrictSendCall = jest.fn();
const mockStrictReceiveCall = jest.fn();
const mockStrictSendPaths = jest.fn(() => ({ call: mockStrictSendCall }));
const mockStrictReceivePaths = jest.fn(() => ({ call: mockStrictReceiveCall }));

// Mock the Server class inside the Horizon namespace, mirroring the approach
// used in transaction.test.ts.
jest.mock("@stellar/stellar-sdk", () => {
  const original = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...original,
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        strictSendPaths: mockStrictSendPaths,
        strictReceivePaths: mockStrictReceivePaths,
      })),
    },
  };
});

const USDC = new Asset(
  "USDC",
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
);

function strictSendRecord(
  destinationAmount: string,
  sourceAmount = "100.0000000"
): PaymentPathRecord {
  return {
    source_asset_type: "native",
    source_amount: sourceAmount,
    destination_asset_type: "credit_alphanum4",
    destination_asset_code: "USDC",
    destination_asset_issuer: USDC.getIssuer(),
    destination_amount: destinationAmount,
    path: [],
  };
}

function strictReceiveRecord(
  sourceAmount: string,
  destinationAmount = "42.0000000"
): PaymentPathRecord {
  return {
    source_asset_type: "native",
    source_amount: sourceAmount,
    destination_asset_type: "credit_alphanum4",
    destination_asset_code: "USDC",
    destination_asset_issuer: USDC.getIssuer(),
    destination_amount: destinationAmount,
    path: [],
  };
}

describe("PathPaymentManager", () => {
  let manager: PathPaymentManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new PathPaymentManager("https://horizon-testnet.stellar.org");
  });

  describe("findStrictSendPaths", () => {
    it("queries Horizon /paths/strict-send and returns the records", async () => {
      const records = [strictSendRecord("250.0000000")];
      mockStrictSendCall.mockResolvedValue({ records });

      const result = await manager.findStrictSendPaths(
        Asset.native(),
        "100.0000000",
        USDC.getIssuer()
      );

      expect(Horizon.Server).toHaveBeenCalledWith(
        "https://horizon-testnet.stellar.org"
      );
      expect(mockStrictSendPaths).toHaveBeenCalledWith(
        Asset.native(),
        "100.0000000",
        USDC.getIssuer()
      );
      expect(result).toEqual(records);
    });

    it("returns an empty array when Horizon yields no records", async () => {
      mockStrictSendCall.mockResolvedValue({});

      const result = await manager.findStrictSendPaths(
        Asset.native(),
        "100.0000000",
        [USDC]
      );

      expect(result).toEqual([]);
    });

    it("rejects an invalid source amount before calling Horizon", async () => {
      await expect(
        manager.findStrictSendPaths(Asset.native(), "-5", [USDC])
      ).rejects.toThrow(TypeError);
      expect(mockStrictSendPaths).not.toHaveBeenCalled();
    });
  });

  describe("findStrictReceivePaths", () => {
    it("queries Horizon /paths/strict-receive and returns the records", async () => {
      const records = [strictReceiveRecord("18.5000000")];
      mockStrictReceiveCall.mockResolvedValue({ records });

      const result = await manager.findStrictReceivePaths(
        [Asset.native()],
        USDC,
        "42.0000000"
      );

      expect(mockStrictReceivePaths).toHaveBeenCalledWith(
        [Asset.native()],
        USDC,
        "42.0000000"
      );
      expect(result).toEqual(records);
    });

    it("rejects an invalid destination amount before calling Horizon", async () => {
      await expect(
        manager.findStrictReceivePaths([Asset.native()], USDC, "0")
      ).rejects.toThrow(TypeError);
      expect(mockStrictReceivePaths).not.toHaveBeenCalled();
    });
  });
});

describe("selectBestStrictSendPath", () => {
  it("picks the path with the highest destination amount", () => {
    const records = [
      strictSendRecord("250.0000000"),
      strictSendRecord("260.5000000"),
      strictSendRecord("259.9999999"),
    ];
    expect(selectBestStrictSendPath(records)?.destination_amount).toBe(
      "260.5000000"
    );
  });

  it("returns null for an empty list", () => {
    expect(selectBestStrictSendPath([])).toBeNull();
  });
});

describe("selectBestStrictReceivePath", () => {
  it("picks the path with the lowest source amount", () => {
    const records = [
      strictReceiveRecord("20.0000000"),
      strictReceiveRecord("18.5000000"),
      strictReceiveRecord("18.5000001"),
    ];
    expect(selectBestStrictReceivePath(records)?.source_amount).toBe(
      "18.5000000"
    );
  });

  it("returns null for an empty list", () => {
    expect(selectBestStrictReceivePath([])).toBeNull();
  });
});

describe("calculateDestinationMin (strict-send slippage)", () => {
  it("applies a 1% slippage tolerance, rounding down", () => {
    expect(calculateDestinationMin("100.0000000", 0.01)).toBe("99.0000000");
  });

  it("returns the same amount for zero slippage", () => {
    expect(calculateDestinationMin("250.5000000", 0)).toBe("250.5000000");
  });

  it("rounds the floor down to the stroop", () => {
    // 1.0000001 XLM = 10000001 stroops; 0.5% off => 9950000.995 -> floor 9950000
    expect(calculateDestinationMin("1.0000001", 0.005)).toBe("0.9950000");
  });

  it("rejects an invalid amount", () => {
    expect(() => calculateDestinationMin("abc", 0.01)).toThrow(TypeError);
  });

  it("rejects an out-of-range slippage", () => {
    expect(() => calculateDestinationMin("100.0000000", 1)).toThrow(TypeError);
    expect(() => calculateDestinationMin("100.0000000", -0.1)).toThrow(
      TypeError
    );
  });
});

describe("calculateSendMax (strict-receive slippage)", () => {
  it("applies a 1% slippage tolerance, rounding up", () => {
    expect(calculateSendMax("100.0000000", 0.01)).toBe("101.0000000");
  });

  it("returns the same amount for zero slippage", () => {
    expect(calculateSendMax("18.5000000", 0)).toBe("18.5000000");
  });

  it("rounds the ceiling up to the stroop", () => {
    // 1.0000001 XLM = 10000001 stroops; +0.5% => 10050001.005 -> ceil 10050002
    expect(calculateSendMax("1.0000001", 0.005)).toBe("1.0050002");
  });

  it("rejects an invalid amount", () => {
    expect(() => calculateSendMax("1.23456789", 0.01)).toThrow(TypeError);
  });

  it("rejects an out-of-range slippage", () => {
    expect(() => calculateSendMax("100.0000000", 2)).toThrow(TypeError);
  });
});

describe("isValidStellarAmount", () => {
  it.each([
    ["100", true],
    ["100.5", true],
    ["0.0000001", true],
    ["1234567.1234567", true],
    ["0", false],
    ["0.00000000", false],
    ["-1", false],
    ["1.23456789", false],
    ["abc", false],
    ["", false],
  ])("validates %s as %s", (value, expected) => {
    expect(isValidStellarAmount(value)).toBe(expected);
  });

  it("rejects non-string input", () => {
    expect(isValidStellarAmount(100 as unknown)).toBe(false);
    expect(isValidStellarAmount(null as unknown)).toBe(false);
  });
});

describe("amountToStroops", () => {
  it.each([
    ["1", 10000000n],
    ["0.0000001", 1n],
    ["1.0000001", 10000001n],
    ["123.4567890", 1234567890n],
  ])("converts %s to %s stroops", (value, expected) => {
    expect(amountToStroops(value)).toBe(expected);
  });

  it("throws on a malformed amount", () => {
    expect(() => amountToStroops("1.23456789")).toThrow(TypeError);
  });
});
