"use strict";
/**
 * stroopsToXlm.ts
 * Converts Stellar "stroops" (the smallest indivisible unit) into a
 * human-readable XLM decimal string.
 *
 * 1 XLM = 10,000,000 stroops (7 decimal places of precision).
 *
 * Uses BigInt + string-based arithmetic throughout — never routes the
 * value through a JS `number`, so there is no floating-point precision
 * loss even for very large balances (e.g. > Number.MAX_SAFE_INTEGER stroops).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stroopsToXlm = stroopsToXlm;
const STROOPS_PER_XLM = 10000000n;
const XLM_DECIMALS = 7;
/**
 * Accepts a stroop amount as a number, string, or bigint and returns
 * a formatted XLM string with exactly 7 decimal places, e.g.:
 *
 *   stroopsToXlm(1)         -> "0.0000001"
 *   stroopsToXlm(10000000)  -> "1.0000000"
 *   stroopsToXlm("123456789012345") -> "12345678.9012345"
 *
 * Throws a TypeError for invalid input (non-integer numbers, malformed
 * strings). Negative values are allowed and preserved with a leading "-".
 */
function stroopsToXlm(stroops) {
    const value = normalizeToBigInt(stroops);
    const isNegative = value < 0n;
    const absValue = isNegative ? -value : value;
    const whole = absValue / STROOPS_PER_XLM;
    const remainder = absValue % STROOPS_PER_XLM;
    const fractional = remainder.toString().padStart(XLM_DECIMALS, "0");
    const sign = isNegative ? "-" : "";
    return `${sign}${whole.toString()}.${fractional}`;
}
function normalizeToBigInt(input) {
    if (typeof input === "bigint") {
        return input;
    }
    if (typeof input === "number") {
        if (!Number.isInteger(input)) {
            throw new TypeError(`stroopsToXlm: expected an integer stroop amount, received non-integer number ${input}. ` +
                `Pass a string or BigInt for large/precise values instead of a float.`);
        }
        if (!Number.isSafeInteger(input)) {
            throw new TypeError(`stroopsToXlm: ${input} exceeds Number.MAX_SAFE_INTEGER and may already have lost precision. ` +
                `Pass the value as a string or BigInt instead.`);
        }
        return BigInt(input);
    }
    const trimmed = input.trim();
    if (!/^-?\d+$/.test(trimmed)) {
        throw new TypeError(`stroopsToXlm: "${input}" is not a valid integer stroop amount string.`);
    }
    return BigInt(trimmed);
}
