import {
  SigningPolicyEngine,
  MaxAmountRule,
  AllowedDestinationsRule,
  AllowedOperationsRule,
  MemoValidationRule,
  PolicyViolationError,
} from '../src/policy';
import { WalletSession } from '../src/session';
import {
  Transaction,
  Operation,
  Asset,
  Keypair,
  Horizon,
  Account,
  TransactionBuilder,
  Memo,
} from '@stellar/stellar-sdk';
import * as fc from 'fast-check';

describe('SigningPolicyEngine & Rules', () => {
  const kp = Keypair.random();
  const destKp = Keypair.random();

  it('should enforce MaxAmountRule successfully', async () => {
    const engine = new SigningPolicyEngine([
      new MaxAmountRule({ maxStroops: '10000000' }), // 1 XLM limit
    ]);

    const account = new Account(kp.publicKey(), '1');
    const tx = new TransactionBuilder(account, {
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

    const account = new Account(kp.publicKey(), '1');
    const tx = new TransactionBuilder(account, {
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

  it('should accept valid text memo within length bounds', async () => {
    const rule = new MemoValidationRule({ maxTextLength: 28 });
    const account = new Account(kp.publicKey(), '1');
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.payment({
          destination: destKp.publicKey(),
          asset: Asset.native(),
          amount: '1.0',
        })
      )
      .addMemo(Memo.text('hello stellar'))
      .setTimeout(30)
      .build();

    expect(() => rule.validate(tx)).not.toThrow();
  });

  it('should reject text memo exceeding max allowed length', async () => {
    const rule = new MemoValidationRule({ maxTextLength: 10 });
    const account = new Account(kp.publicKey(), '1');
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.payment({
          destination: destKp.publicKey(),
          asset: Asset.native(),
          amount: '1.0',
        })
      )
      .addMemo(Memo.text('123456789012345'))
      .setTimeout(30)
      .build();

    expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
  });

  it('should enforce allowed memo types and reject unauthorized types', async () => {
    const rule = new MemoValidationRule({ allowedTypes: ['text', 'id'] });
    const account = new Account(kp.publicKey(), '1');
    const hash = Buffer.alloc(32, 1);
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.payment({
          destination: destKp.publicKey(),
          asset: Asset.native(),
          amount: '1.0',
        })
      )
      .addMemo(Memo.hash(hash))
      .setTimeout(30)
      .build();

    expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
  });

  it('should reject missing memo when requireMemo is enabled', async () => {
    const rule = new MemoValidationRule({ requireMemo: true });
    const account = new Account(kp.publicKey(), '1');
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.payment({
          destination: destKp.publicKey(),
          asset: Asset.native(),
          amount: '1.0',
        })
      )
      .setTimeout(30)
      .build();

    expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
  });

  it('should allow transaction with permitted operation types in AllowedOperationsRule', async () => {
    const rule = new AllowedOperationsRule({
      allowedOperations: ['payment', 'changeTrust'],
    });

    const account = new Account(kp.publicKey(), '1');
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.payment({
          destination: destKp.publicKey(),
          asset: Asset.native(),
          amount: '1.0',
        })
      )
      .addOperation(
        Operation.changeTrust({
          asset: new Asset('USDC', kp.publicKey()),
          limit: '1000',
        })
      )
      .setTimeout(30)
      .build();

    expect(() => rule.validate(tx)).not.toThrow();
  });

  it('should reject transaction containing unapproved operation types in AllowedOperationsRule', async () => {
    const rule = new AllowedOperationsRule({
      allowedOperations: ['payment', 'changeTrust'],
    });

    const account = new Account(kp.publicKey(), '1');
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.accountMerge({
          destination: destKp.publicKey(),
        })
      )
      .setTimeout(30)
      .build();

    expect(() => rule.validate(tx)).toThrow(PolicyViolationError);
    expect(() => rule.validate(tx)).toThrow(
      'Operation type "accountMerge" is not in the allowed operations whitelist'
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

    const sessionKp = Keypair.random();
    const sessionDest = Keypair.random();
    const session = new WalletSession(sessionKp.publicKey(), mockServer, 'https://mock-horizon.com');
    await session.refresh();

    expect(session.getCachedSequence()).toBe('100');
    expect(session.getCachedFee()).toBe(150);

    const tx = session.buildTransaction([
      Operation.payment({
        destination: sessionDest.publicKey(),
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
