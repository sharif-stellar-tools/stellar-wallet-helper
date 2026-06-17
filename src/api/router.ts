import { CoreEngine } from '../core/engine';

const engine = new CoreEngine();

/**
 * The application router that dispatches incoming requests to the core engine.
 */
export const router = {
  /**
   * Handles an incoming request by processing the transaction identified by `req.id`.
   *
   * @param req - The incoming request object.
   * @param req.id - The unique identifier of the transaction to process.
   * @returns A Promise that resolves to `true` if the transaction was processed successfully.
   */
  handle: (req: { id: string }) => engine.processTx(req.id),
};
