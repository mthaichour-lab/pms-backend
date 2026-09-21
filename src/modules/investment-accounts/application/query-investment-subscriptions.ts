import type { InvestmentSubscriptionState } from '../domain/investment-subscription.js';

export interface SubscriptionBalance extends InvestmentSubscriptionState {
  /** Ledger balance from accepted deposit and withdrawal events, never a forecast. */
  balance: string;
  totalDeposits: string;
  totalWithdrawals: string;
  termsAccepted: boolean;
}
export interface InvestmentSubscriptionQueryRepository {
  listWithBalances(limit: number, offset: number): Promise<{ items: SubscriptionBalance[]; total: number }>;
  findWithBalance(accountId: string): Promise<SubscriptionBalance | undefined>;
}

export class QueryInvestmentSubscriptions {
  constructor(private readonly repository: InvestmentSubscriptionQueryRepository) {}

  list(limit = 50, offset = 0) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Limit must be an integer between 1 and 100');
    if (!Number.isSafeInteger(offset) || offset < 0) throw new TypeError('Offset must be a non-negative integer');
    return this.repository.listWithBalances(limit, offset);
  }

  async get(accountId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) throw new TypeError('Subscription identifier must be a UUID');
    const state = await this.repository.findWithBalance(accountId);
    if (!state) throw new Error(`Investment subscription not found: ${accountId}`);
    return state;
  }
}
