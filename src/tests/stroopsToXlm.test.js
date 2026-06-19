"use strict";
/**
 * stroopsToXlm.test.ts
 * Unit tests verifying conversions of 1 stroop, 10 million stroops, and
 * massive balances — per the acceptance criteria in issue #58.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const stroopsToXlm_1 = require("../utils/stroopsToXlm");
describe("stroopsToXlm — basic conversions", () => {
    test("converts 1 stroop to the smallest representable XLM amount", () => {
        expect((0, stroopsToXlm_1.stroopsToXlm)(1)).toBe("0.0000001");
    });
    test("converts 10,000,000 stroops to exactly 1 XLM", () => {
        expect((0, stroopsToXlm_1.stroopsToXlm)(10000000)).toBe("1.0000000");
    });
    test("converts 0 stroops to 0 XLM", () => {
        expect((0, stroopsToXlm_1.stroopsToXlm)(0)).toBe("0.0000000");
    });
    test("converts a typical balance with both whole and fractional parts", () => {
        expect((0, stroopsToXlm_1.stroopsToXlm)(123456789)).toBe("12.3456789");
    });
    test("accepts string input", () => {
        expect((0, stroopsToXlm_1.stroopsToXlm)("10000000")).toBe("1.0000000");
    });
    test("accepts BigInt input", () => {
        expect((0, stroopsToXlm_1.stroopsToXlm)(10000000n)).toBe("1.0000000");
    });
});
describe("stroopsToXlm — large balances (precision-critical)", () => {
    test("handles a balance well beyond Number.MAX_SAFE_INTEGER via string input", () => {
        // 12,345,678,901,234,567 stroops -> 1,234,567,890.1234567 XLM
        expect((0, stroopsToXlm_1.stroopsToXlm)("12345678901234567")).toBe("1234567890.1234567");
    });
    test("handles a massive balance via BigInt input without precision loss", () => {
        const massive = 999999999999999999n;
        const whole = massive / 10000000n;
        const frac = (massive % 10000000n).toString().padStart(7, "0");
        expect((0, stroopsToXlm_1.stroopsToXlm)(massive)).toBe(`${whole}.${frac}`);
    });
    test("does not lose precision compared to naive floating-point division", () => {
        const stroops = "9007199254740993000000"; // far beyond MAX_SAFE_INTEGER
        const result = (0, stroopsToXlm_1.stroopsToXlm)(stroops);
        expect(result).toBe("900719925474099.3000000");
    });
});
describe("stroopsToXlm — negative values", () => {
    test("preserves a negative sign for negative stroop amounts", () => {
        expect((0, stroopsToXlm_1.stroopsToXlm)(-10000000)).toBe("-1.0000000");
    });
    test("handles negative fractional amounts correctly", () => {
        expect((0, stroopsToXlm_1.stroopsToXlm)(-1)).toBe("-0.0000001");
    });
});
describe("stroopsToXlm — input validation", () => {
    test("throws for non-integer number input", () => {
        expect(() => (0, stroopsToXlm_1.stroopsToXlm)(1.5)).toThrow(TypeError);
    });
    test("throws for a number exceeding Number.MAX_SAFE_INTEGER", () => {
        expect(() => (0, stroopsToXlm_1.stroopsToXlm)(Number.MAX_SAFE_INTEGER + 10)).toThrow(TypeError);
    });
    test("throws for a malformed numeric string", () => {
        expect(() => (0, stroopsToXlm_1.stroopsToXlm)("12.34")).toThrow(TypeError);
        expect(() => (0, stroopsToXlm_1.stroopsToXlm)("abc")).toThrow(TypeError);
        expect(() => (0, stroopsToXlm_1.stroopsToXlm)("")).toThrow(TypeError);
    });
    test("accepts a string with surrounding whitespace", () => {
        expect((0, stroopsToXlm_1.stroopsToXlm)("  10000000  ")).toBe("1.0000000");
    });
});
