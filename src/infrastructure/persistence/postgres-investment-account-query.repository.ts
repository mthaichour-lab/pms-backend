import type {
  InvestmentAccountQueryRepository,
  InvestmentAccountSnapshot,
} from '../../modules/investment-accounts/application/get-investment-account-snapshot.js';
import type { InvestmentAccountStatus } from '../../modules/investment-accounts/domain/investment-account.js';
import type { SqlClient } from './postgres-client.js';

interface SnapshotRow {
  account_id: string;
  product_code: string;
  account_currency: string;
  opened_on: string;
  status: InvestmentAccountStatus;
  closed_on: string | null;
  position_business_date: string | null;
  value_date: string | null;
  balance: string | null;
  position_currency: string | null;
}

export class PostgresInvestmentAccountQueryRepository implements InvestmentAccountQueryRepository {
  constructor(private readonly database: SqlClient) {}

  async findSnapshot(accountId: string, businessDate: string): Promise<InvestmentAccountSnapshot | undefined> {
    const result = await this.database.query<SnapshotRow>(
      `SELECT a.account_id::text, a.product_code, a.currency_code AS account_currency,
              a.opened_on::text, a.status, a.closed_on::text,
              p.business_date::text AS position_business_date, p.value_date::text,
              p.balance::text, p.currency_code AS position_currency
       FROM investment.account a
       LEFT JOIN LATERAL (
         SELECT business_date, value_date, balance, currency_code
         FROM investment.position_snapshot
         WHERE account_id = a.account_id AND business_date <= $2::date
         ORDER BY business_date DESC, value_date DESC, created_at DESC
         LIMIT 1
       ) p ON true
       WHERE a.account_id = $1::uuid
         AND a.opened_on <= $2::date
         AND (a.closed_on IS NULL OR a.closed_on >= $2::date)`,
      [accountId, businessDate],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      accountId: row.account_id,
      productCode: row.product_code,
      currency: row.account_currency,
      openedOn: row.opened_on,
      status: row.status,
      closedOn: row.closed_on ?? undefined,
      position: row.position_business_date && row.value_date && row.balance && row.position_currency
        ? {
            businessDate: row.position_business_date,
            valueDate: row.value_date,
            balance: row.balance,
            currency: row.position_currency,
          }
        : undefined,
    };
  }
}
