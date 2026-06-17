import { CoreEngine } from '../core/engine';

const engine = new CoreEngine();

export const router = {
  /**
   * Route handler entrypoint.
   *
   * @param req Request payload containing a transaction identifier.
   * @returns Handler result from the core engine.
   */
  handle: (req: { id: string }) => engine.processTx(req.id),
};
