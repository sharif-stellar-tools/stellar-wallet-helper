import { CoreEngine } from '../core/engine';

const engine = new CoreEngine();

export const router = {
  handle: (req: { id: string }) => engine.processTx(req.id),
};
