import { SigningPolicyEngine, MaxAmountRule, AllowedDestinationsRule, PolicyViolationError } from '../src/policy';
import { WalletSession } from '../src/session';
import { Transaction, Operation, Asset, Keypair, Horizon } from '@stellar/stellar-sdk';
import axios from 'axios';
import * as fc from 'fast-check';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SigningPolicyEngine & Rules', () => {
  const kp = Keypair.random();
  const destKp = Keypair.random();

  it('should enforce MaxAmountRule successfully', async () => {
    const engine = new SigningPolicyEngine([
      new MaxAmountRule({ maxStroops: '10000000' }), // 1 XLM limit
    ]);

    const account = new Horizon.Account(kp.publicKey(), '1');
    const tx = new Horizon.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.payment({
          destination: destKp.publicKey(),
          asset: Asset.native(),
          amount: '0.5',
        })
      )
      .setTimeout(30)
      .build();

    const signedTx = await engine.validateAndSign(tx, kp.secret());
    expect(signedTx.signatures.length).toBe(1);
  });

  it('should reject transactions exceeding MaxAmountRule', async () => {
    const engine = new SigningPolicyEngine([
      new MaxAmountRule({ maxStroops: '10000000' }), // 1 XLM limit
    ]);

    const account = new Horizon.Account(kp.publicKey(), '1');
    const tx = new Horizon.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.payment({
          destination: destKp.publicKey(),
          asset: Asset.native(),
          amount: '1.5', // 1.5 XLM = 15000000 stroops
        })
      )
      .setTimeout(30)
      .build();

    await expect(engine.validateAndSign(tx, kp.secret())).rejects.toThrow(
      PolicyViolationError
    );
  });
});

describe('WalletSession Manager', () => {
  it('should cache sequence numbers and increment on build', async () => {
    const mockAccount = {
      sequenceNumber: () => '100',
    };
    const mockFeeStats = {
      max_fee: { mode: '150' },
    };

    const mockServer = {
      loadAccount: jest.fn().mockResolvedValue(mockAccount),
      feeStats: jest.fn().mockResolvedValue(mockFeeStats),
    } as unknown as Horizon.Server;

    const session = new WalletSession('GB...PUBLIC_KEY', mockServer, 'https://mock-horizon.com');
    await session.refresh();

    expect(session.getCachedSequence()).toBe('100');
    expect(session.getCachedFee()).toBe(150);

    const tx = session.buildTransaction([
      Operation.payment({
        destination: 'GB...DEST',
        asset: Asset.native(),
        amount: '10.0',
      }),
    ]);

    expect(tx).toBeDefined();
    expect(session.getCachedSequence()).toBe('101');
  });
});

describe('Property-Based Signing Verification', () => {
  it('should always correctly sign matching signatures for generated seed keys', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }), (seed) => {
        const kp = Keypair.fromRawEd25519Seed(Buffer.from(seed));
        const message = Buffer.from('StellarSignatureBaseMockBytes');
        const signature = kp.sign(message);
        
        const isVerified = kp.verify(message, signature);
        expect(isVerified).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
