jest.mock('../src/core/engine');

import { CoreEngine } from '../src/core/engine';

describe('router (issue #51 — singleton CoreEngine)', () => {
  it('instantiates CoreEngine only once across multiple requests', () => {
    jest.resetModules();
    const { CoreEngine: MockEngine } = require('../src/core/engine');
    const mockProcessTx = jest.fn().mockResolvedValue(true);
    (MockEngine as jest.Mock).mockImplementation(() => ({ processTx: mockProcessTx }));

    const { router } = require('../src/api/router');

    router.handle({ id: 'tx1' });
    router.handle({ id: 'tx2' });
    router.handle({ id: 'tx3' });

    expect(MockEngine).toHaveBeenCalledTimes(1);
  });

  it('calls processTx with the correct request id', () => {
    jest.resetModules();
    const { CoreEngine: MockEngine } = require('../src/core/engine');
    const mockProcessTx = jest.fn().mockResolvedValue(true);
    (MockEngine as jest.Mock).mockImplementation(() => ({ processTx: mockProcessTx }));

    const { router } = require('../src/api/router');
    router.handle({ id: 'tx-abc' });

    expect(mockProcessTx).toHaveBeenCalledWith('tx-abc');
  });
});
