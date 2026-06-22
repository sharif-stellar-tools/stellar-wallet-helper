"use strict";
/**
 * path-payment-utils.ts
 *
 * Standardized utilities for working with Stellar **path payments**.
 *
 * Stellar supports two flavours of cross-asset (path) payment:
 *
 *  - **strict-send**  — you fix the amount you *send* and Horizon finds the
 *    best path; you must commit to a `destMin` (the minimum amount the
 *    destination is allowed to receive) to protect against slippage.
 *  - **strict-receive** — you fix the amount the destination *receives* and
 *    Horizon finds the best path; you must commit to a `sendMax` (the maximum
 *    amount you are willing to send) to protect against slippage.
 *
 * This module wraps Horizon's `/paths/strict-send` and `/paths/strict-receive`
 * (a.k.a. the legacy `/paths`) endpoints and adds precise, floating-point-free
 * helpers for computing and validating `destMin` / `sendMax` from a quoted
 * path.
 *
 * All amount math is performed in **stroops** (1 XLM = 10,000,000 stroops)
 * using `BigInt`, so there is never any floating-point precision loss — even
 * for balances larger than `Number.MAX_SAFE_INTEGER`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathPaymentManager = void 0;
exports.selectBestStrictSendPath = selectBestStrictSendPath;
exports.selectBestStrictReceivePath = selectBestStrictReceivePath;
exports.calculateDestinationMin = calculateDestinationMin;
exports.calculateSendMax = calculateSendMax;
exports.isValidStellarAmount = isValidStellarAmount;
exports.amountToStroops = amountToStroops;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const stroopsToXlm_1 = require("./utils/stroopsToXlm");
/** Number of stroops in one unit of any Stellar asset (7 decimal places). */
const STROOPS_PER_UNIT = 10000000n;
/** Total basis points in 100% (1 bps = 0.01%). */
const TOTAL_BPS = 10000n;
/**
 * Manages path-payment discovery and slippage calculations against a Stellar
 * Horizon server.
 */
class PathPaymentManager {
    /**
     * Creates a new PathPaymentManager connected to the specified Horizon server.
     *
     * @param serverUrl - Base URL of the Horizon server
     *   (e.g. `'https://horizon-testnet.stellar.org'`).
     */
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.server = new stellar_sdk_1.Horizon.Server(this.serverUrl);
    }
    /**
     * Finds **strict-send** payment paths via Horizon's `/paths/strict-send`
     * endpoint: "I want to send exactly `sourceAmount` of `sourceAsset` — what
     * can the destination receive?"
     *
     * @param sourceAsset - The asset being sent.
     * @param sourceAmount - The exact amount to send, as a decimal string
     *   (e.g. `'100.50'`).
     * @param destination - Either the destination account's public key (Horizon
     *   returns paths for every asset that account trusts) or an explicit list
     *   of candidate destination {@link Asset}s.
     * @returns The list of available payment paths, ordered by Horizon from best
     *   (highest `destination_amount`) to worst.
     */
    async findStrictSendPaths(sourceAsset, sourceAmount, destination) {
        assertValidAmount(sourceAmount, "sourceAmount");
        const builder = this.server.strictSendPaths(sourceAsset, sourceAmount, destination);
        const response = await builder.call();
        return (response.records ?? []);
    }
    /**
     * Finds **strict-receive** payment paths via Horizon's
     * `/paths/strict-receive` endpoint (also reachable as the legacy `/paths`):
     * "I want the destination to receive exactly `destinationAmount` of
     * `destinationAsset` — what would I need to send?"
     *
     * @param source - Either the sending account's public key (Horizon considers
     *   every asset the account holds) or an explicit list of candidate source
     *   {@link Asset}s.
     * @param destinationAsset - The asset the destination should receive.
     * @param destinationAmount - The exact amount the destination should receive,
     *   as a decimal string (e.g. `'42.0'`).
     * @returns The list of available payment paths, ordered by Horizon from best
     *   (lowest `source_amount`) to worst.
     */
    async findStrictReceivePaths(source, destinationAsset, destinationAmount) {
        assertValidAmount(destinationAmount, "destinationAmount");
        const builder = this.server.strictReceivePaths(source, destinationAsset, destinationAmount);
        const response = await builder.call();
        return (response.records ?? []);
    }
}
exports.PathPaymentManager = PathPaymentManager;
/**
 * Selects the best **strict-send** path from a set of records — the one that
 * yields the largest `destination_amount`.
 *
 * @param records - Candidate paths (e.g. from {@link PathPaymentManager.findStrictSendPaths}).
 * @returns The record with the highest destination amount, or `null` if the
 *   list is empty.
 */
function selectBestStrictSendPath(records) {
    if (!Array.isArray(records) || records.length === 0) {
        return null;
    }
    return records.reduce((best, current) => amountToStroops(current.destination_amount) >
        amountToStroops(best.destination_amount)
        ? current
        : best);
}
/**
 * Selects the best **strict-receive** path from a set of records — the one
 * that requires the smallest `source_amount`.
 *
 * @param records - Candidate paths (e.g. from {@link PathPaymentManager.findStrictReceivePaths}).
 * @returns The record with the lowest source amount, or `null` if the list is
 *   empty.
 */
function selectBestStrictReceivePath(records) {
    if (!Array.isArray(records) || records.length === 0) {
        return null;
    }
    return records.reduce((best, current) => amountToStroops(current.source_amount) <
        amountToStroops(best.source_amount)
        ? current
        : best);
}
/**
 * Computes the **minimum destination amount** (`destMin`) for a strict-send
 * path payment, given a quoted destination amount and a slippage tolerance.
 *
 * `destMin = quotedDestinationAmount * (1 - slippageTolerance)`, rounded
 * **down** (conservative — you are guaranteed to receive at least this much or
 * the payment fails).
 *
 * @param quotedDestinationAmount - The `destination_amount` from the chosen
 *   path, as a decimal string.
 * @param slippageTolerance - Acceptable slippage as a decimal fraction in the
 *   range `[0, 1)` — e.g. `0.01` for 1%. Internally quantised to basis points.
 * @returns The `destMin` value as a 7-decimal Stellar amount string, ready to
 *   pass to `Operation.pathPaymentStrictSend`.
 * @throws {TypeError} If the amount or slippage is invalid.
 */
function calculateDestinationMin(quotedDestinationAmount, slippageTolerance) {
    assertValidAmount(quotedDestinationAmount, "quotedDestinationAmount");
    const bps = slippageToleranceToBps(slippageTolerance);
    const quoted = amountToStroops(quotedDestinationAmount);
    // Round down so the floor we accept is never overstated.
    const destMin = (quoted * (TOTAL_BPS - bps)) / TOTAL_BPS;
    return (0, stroopsToXlm_1.stroopsToXlm)(destMin);
}
/**
 * Computes the **maximum send amount** (`sendMax`) for a strict-receive path
 * payment, given a quoted source amount and a slippage tolerance.
 *
 * `sendMax = quotedSourceAmount * (1 + slippageTolerance)`, rounded **up**
 * (conservative — you authorise spending up to this much; the payment fails if
 * the path would cost more).
 *
 * @param quotedSourceAmount - The `source_amount` from the chosen path, as a
 *   decimal string.
 * @param slippageTolerance - Acceptable slippage as a decimal fraction in the
 *   range `[0, 1)` — e.g. `0.01` for 1%. Internally quantised to basis points.
 * @returns The `sendMax` value as a 7-decimal Stellar amount string, ready to
 *   pass to `Operation.pathPaymentStrictReceive`.
 * @throws {TypeError} If the amount or slippage is invalid.
 */
function calculateSendMax(quotedSourceAmount, slippageTolerance) {
    assertValidAmount(quotedSourceAmount, "quotedSourceAmount");
    const bps = slippageToleranceToBps(slippageTolerance);
    const quoted = amountToStroops(quotedSourceAmount);
    const scaled = quoted * (TOTAL_BPS + bps);
    // Round up so the ceiling we authorise is never understated.
    const sendMax = scaled % TOTAL_BPS === 0n
        ? scaled / TOTAL_BPS
        : scaled / TOTAL_BPS + 1n;
    return (0, stroopsToXlm_1.stroopsToXlm)(sendMax);
}
/**
 * Validates that `value` is a well-formed, positive Stellar amount string with
 * at most 7 decimal places.
 *
 * @param value - The amount to validate.
 * @returns `true` if the value is a valid Stellar amount, otherwise `false`.
 */
function isValidStellarAmount(value) {
    if (typeof value !== "string") {
        return false;
    }
    const trimmed = value.trim();
    if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
        return false;
    }
    // Must be strictly positive.
    return amountToStroops(trimmed) > 0n;
}
/**
 * Converts a decimal Stellar amount string into stroops (`BigInt`).
 *
 * @param amount - A non-negative decimal amount string with up to 7 decimals.
 * @returns The amount expressed in stroops.
 * @throws {TypeError} If the string is not a valid amount.
 */
function amountToStroops(amount) {
    if (typeof amount !== "string") {
        throw new TypeError(`path-payment-utils: expected an amount string, received ${typeof amount}.`);
    }
    const trimmed = amount.trim();
    if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
        throw new TypeError(`path-payment-utils: "${amount}" is not a valid Stellar amount (max 7 decimals, non-negative).`);
    }
    const [whole, fraction = ""] = trimmed.split(".");
    const paddedFraction = fraction.padEnd(7, "0");
    return BigInt(whole) * STROOPS_PER_UNIT + BigInt(paddedFraction);
}
/**
 * Throws a descriptive {@link TypeError} unless `value` is a valid Stellar
 * amount. Used to guard the public helpers.
 */
function assertValidAmount(value, label) {
    if (!isValidStellarAmount(value)) {
        throw new TypeError(`path-payment-utils: ${label} must be a positive Stellar amount string ` +
            `with at most 7 decimal places, received ${JSON.stringify(value)}.`);
    }
}
/**
 * Converts a decimal slippage fraction (e.g. `0.01`) into integer basis
 * points (e.g. `100`), validating the range `[0, 1)`.
 */
function slippageToleranceToBps(slippageTolerance) {
    if (typeof slippageTolerance !== "number" ||
        !Number.isFinite(slippageTolerance) ||
        slippageTolerance < 0 ||
        slippageTolerance >= 1) {
        throw new TypeError(`path-payment-utils: slippageTolerance must be a number in [0, 1) ` +
            `(e.g. 0.01 for 1%), received ${JSON.stringify(slippageTolerance)}.`);
    }
    // Quantise to basis-point granularity (0.01%).
    return BigInt(Math.round(slippageTolerance * 10000));
}
