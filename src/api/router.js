"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const engine_1 = require("../core/engine");
const engine = new engine_1.CoreEngine();
/**
 * The application router that dispatches incoming requests to the core engine.
 */
exports.router = {
    /**
     * Handles an incoming request by processing the transaction identified by `req.id`.
     *
     * @param req - The incoming request object.
     * @param req.id - The unique identifier of the transaction to process.
     * @returns A Promise that resolves to `true` if the transaction was processed successfully.
     */
    handle: (req) => engine.processTx(req.id),
};
