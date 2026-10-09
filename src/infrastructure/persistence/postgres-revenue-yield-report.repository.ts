import type { Pool } from 'pg';
import type { RevenueYieldRepository, RevenueYieldSourceData } from '../../modules/reporting/application/query-revenue-yield-report.js';

export class PostgresRevenueYieldReportRepository implements RevenueYieldRepository {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async forPeriod(poolId: string, periodFrom: string, periodTo: string): Promise<RevenueYieldSourceData | undefined> {
    const base = await this.pool.query<{ invested_amount: string; currency_code: string; business_date: string }>(
      `SELECT invested_amount::text, currency_code, business_date::text FROM pooling.composition_snapshot
        WHERE pool_id = $1 AND certified AND business_date <= $2::date
        ORDER BY business_date DESC LIMIT 1`,
      [poolId, periodTo],
    );
    const snapshot = base.rows[0];
    if (!snapshot) return undefined;
    const records = await this.pool.query<{ gl_account_code: string; amount: string; cash_status: 'ACCRUED' | 'RECEIVED'; maturity_date: string | null }>(
      `SELECT gl_account_code, amount::text, cash_status, maturity_date::text
         FROM revenue.recognized_income
        WHERE pool_id = $1 AND business_date BETWEEN $2::date AND $3::date
        ORDER BY gl_account_code`,
      [poolId, periodFrom, periodTo],
    );
    return {
      businessDate: snapshot.business_date,
      currency: snapshot.currency_code,
      capitalBase: snapshot.invested_amount,
      records: records.rows.map((row) => ({
        glAccountCode: row.gl_account_code,
        amount: row.amount,
        cashStatus: row.cash_status,
        ...(row.maturity_date ? { maturityDate: row.maturity_date } : {}),
      })),
    };
  }
}
