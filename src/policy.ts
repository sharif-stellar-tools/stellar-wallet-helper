import { Transaction, Keypair } from '@stellar/stellar-sdk';
import { PolicyRule, MaxAmountRuleOptions, AllowedDestinationsRuleOptions } from './types';

export class PolicyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyViolationError';
  }
}

export class MaxAmountRule implements PolicyRule {
  public name = 'MaxAmountRule';
  private maxStroops: bigint;

  constructor(options: MaxAmountRuleOptions) {
    this.maxStroops = BigInt(options.maxStroops);
  }

  public validate(tx: Transaction): void {
    for (const op of tx.operations) {
      if (op.type === 'payment') {
        // Convert Stellar standard string amount to stroops (amount * 10^7)
        const amountStroops = BigInt(Math.round(parseFloat(op.amount) * 10000000));
        if (amountStroops > this.maxStroops) {
          throw new PolicyViolationError(
            `Transaction operation amount of ${op.amount} XLM (${amountStroops} stroops) exceeds the allowed limit of ${this.maxStroops} stroops.`
          );
        }
      }
    }
  }
}

export class AllowedDestinationsRule implements PolicyRule {
  public name = 'AllowedDestinationsRule';
  private destinations: Set<string>;

  constructor(options: AllowedDestinationsRuleOptions) {
    this.destinations = new Set(options.destinations);
  }

  public validate(tx: Transaction): void {
    for (const op of tx.operations) {
      if (op.type === 'payment') {
        if (!this.destinations.has(op.destination)) {
          throw new PolicyViolationError(
            `Transaction destination address ${op.destination} is not in the allowed destinations list.`
          );
        }
      }
    }
  }
}

export class SigningPolicyEngine {
  constructor(private rules: PolicyRule[]) {}

  /**
   * Validates a transaction against all configured rules and signs it if successful.
   */
  public async validateAndSign(tx: Transaction, secretKey: string): Promise<Transaction> {
    for (const rule of this.rules) {
      rule.validate(tx);
    }

    const kp = Keypair.fromSecret(secretKey);
    tx.sign(kp);
    return tx;
  }
}
