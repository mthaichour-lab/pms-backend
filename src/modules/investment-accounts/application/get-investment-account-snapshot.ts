import type { InvestmentAccountStatus } from '../domain/investment-account.js';

export interface InvestmentAccountSnapshot {
  accountId: string;
  productCode: string;
  currency: string;
  openedOn: string;
  status: InvestmentAccountStatus;
  closedOn?: string;
  position?: {
    businessDate: string;
    valueDate: string;
    balance: string;
    currency: string;
  };
}

export interface InvestmentAccountQueryRepository {
  findSnapshot(accountId: string, businessDate: string): Promise<InvestmentAccountSnapshot | undefined>;
}

export class GetInvestmentAccountSnapshot {
  constructor(private readonly repository: InvestmentAccountQueryRepository) {}

  async execute(accountId: string, businessDate: string): Promise<InvestmentAccountSnapshot> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) {
      throw new TypeError('Investment account identifier must be a UUID');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate) || Number.isNaN(Date.parse(`${businessDate}T00:00:00Z`))) {
      throw new TypeError('Invalid business date');
    }
    const snapshot = await this.repository.findSnapshot(accountId, businessDate);
    if (!snapshot) throw new Error(`Investment account not found: ${accountId}`);
    if (snapshot.position && snapshot.position.currency !== snapshot.currency) {
      throw new Error('Investment position currency differs from account currency');
    }
    return snapshot;
  }
}
