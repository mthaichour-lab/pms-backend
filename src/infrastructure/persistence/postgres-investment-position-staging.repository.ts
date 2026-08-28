import type { Pool } from 'pg';

import type {
  InvestmentPositionRow,
  InvestmentPositionStagingRepository,
} from '../../modules/cbs-ingestion/application/stage-investment-positions.js';

export class PostgresInvestmentPositionStagingRepository implements InvestmentPositionStagingRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async stage(batchId: string, rows: readonly InvestmentPositionRow[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [index, row] of rows.entries()) {
        const staged = await client.query<{
          account_id: string; customer_token: string; product_code: string; currency_code: string;
          opened_on: string; business_date: string; value_date: string; balance: string;
        }>(
          `INSERT INTO integration.cbs_investment_position_staging
             (batch_id, row_number, account_id, customer_token, product_code,
              currency_code, opened_on, business_date, value_date, balance)
           VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7::date, $8::date, $9::date, $10::numeric)
           ON CONFLICT (batch_id, row_number) DO UPDATE SET batch_id = EXCLUDED.batch_id
           RETURNING account_id::text, customer_token, product_code, currency_code,
             opened_on::text, business_date::text, value_date::text, balance::text`,
          [batchId, index + 1, row.accountId, row.customerToken, row.productCode, row.currency,
            row.openedOn, row.businessDate, row.valueDate, row.balance],
        );
        const stored = staged.rows[0];
        if (!stored || stored.customer_token !== row.customerToken || stored.product_code !== row.productCode ||
          stored.account_id !== row.accountId || stored.currency_code !== row.currency ||
          stored.opened_on !== row.openedOn || stored.business_date !== row.businessDate ||
          stored.value_date !== row.valueDate || normalizeDecimal(stored.balance) !== normalizeDecimal(row.balance)) {
          throw new Error(`CBS staging replay conflict at row ${index + 1}`);
        }
      }
      const transition = await client.query(
        `UPDATE integration.cbs_batch SET state = 'STAGED', updated_at = clock_timestamp()
         WHERE batch_id = $1::uuid AND state IN ('SCANNED', 'STAGED')`, [batchId],
      );
      if (transition.rowCount !== 1) throw new Error(`CBS batch ${batchId} is not ready for staging`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function normalizeDecimal(value: string): string {
  const [integer, fraction = ''] = value.split('.');
  return fraction.replace(/0+$/, '') ? `${integer}.${fraction.replace(/0+$/, '')}` : integer;
}
