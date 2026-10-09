import type { Pool } from 'pg';
import type { SubscriberYieldRepository, SubscriberYieldSourceData } from '../../modules/reporting/application/query-subscriber-yield-report.js';

export class PostgresSubscriberYieldReportRepository implements SubscriberYieldRepository {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async latest(poolId: string): Promise<SubscriberYieldSourceData | undefined> {
    const head = await this.pool.query<{ run_id: string; business_date: string; currency_code: string }>(
      `SELECT run_id::text, business_date::text, currency_code FROM calculation.run
        WHERE pool_id = $1 AND status IN ('POSTED', 'ARCHIVED') ORDER BY business_date DESC LIMIT 1`,
      [poolId],
    );
    const run = head.rows[0];
    if (!run) return undefined;
    const rows = await this.pool.query<{
      account_id: string; capital_invested: string; allocated_profit: string;
      realized_rate_percent: string; distributed_rate_percent: string; maturity_date: string;
    }>(
      `SELECT explanation.account_id::text,
              explanation.output ->> 'capitalInvested' AS capital_invested,
              explanation.output ->> 'allocatedShare' AS allocated_profit,
              explanation.output ->> 'realizedRatePercent' AS realized_rate_percent,
              explanation.output ->> 'distributedRatePercent' AS distributed_rate_percent,
              subscription.maturity_date::text AS maturity_date
         FROM calculation.profit_explanation_output explanation
         JOIN investment.subscription_account subscription ON subscription.account_id = explanation.account_id
        WHERE explanation.run_id = $1::uuid AND subscription.maturity_date IS NOT NULL
        ORDER BY explanation.account_id`,
      [run.run_id],
    );
    return {
      runId: run.run_id,
      businessDate: run.business_date,
      currency: run.currency_code,
      sources: rows.rows.map((row) => ({
        accountId: row.account_id,
        capitalInvested: row.capital_invested,
        allocatedProfit: row.allocated_profit,
        realizedRatePercent: row.realized_rate_percent,
        distributedRatePercent: row.distributed_rate_percent,
        maturityDate: row.maturity_date,
      })),
    };
  }
}
