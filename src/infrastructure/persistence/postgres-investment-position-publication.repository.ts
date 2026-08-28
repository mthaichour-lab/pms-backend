import type { Pool } from 'pg';

import type { InvestmentPositionPublicationRepository } from '../../modules/cbs-ingestion/application/publish-investment-positions.js';

export class PostgresInvestmentPositionPublicationRepository implements InvestmentPositionPublicationRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async publish(batchId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const approval = await client.query(
        `UPDATE integration.cbs_batch
         SET state = 'APPROVED', state_reason = 'AUTO_QUALITY_CONTROLS', updated_at = clock_timestamp()
         WHERE batch_id = $1::uuid AND state IN ('VALIDATED', 'APPROVED')`, [batchId],
      );
      if (approval.rowCount !== 1) throw new Error(`CBS batch ${batchId} is not validated`);
      await client.query(
        `INSERT INTO investment.account
           (account_id, customer_token, product_code, currency_code, opened_on, status)
         SELECT DISTINCT account_id, customer_token, product_code, currency_code, opened_on, 'ACTIVE'
         FROM integration.cbs_investment_position_staging WHERE batch_id = $1::uuid
         ON CONFLICT (account_id) DO NOTHING`, [batchId],
      );
      const conflicts = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM integration.cbs_investment_position_staging s
         JOIN investment.account a ON a.account_id = s.account_id
         WHERE s.batch_id = $1::uuid AND (
           a.customer_token <> s.customer_token OR a.product_code <> s.product_code OR
           a.currency_code <> s.currency_code OR a.opened_on <> s.opened_on
         )`, [batchId],
      );
      if (Number(conflicts.rows[0]?.count ?? 0) > 0) throw new Error('Investment account publication conflict');
      const positions = await client.query(
        `INSERT INTO investment.position_snapshot
           (account_id, business_date, value_date, currency_code, balance, source_batch_id)
         SELECT account_id, business_date, value_date, currency_code, balance, batch_id
         FROM integration.cbs_investment_position_staging WHERE batch_id = $1::uuid
         ON CONFLICT (account_id, business_date, value_date, source_batch_id) DO NOTHING`, [batchId],
      );
      const publication = await client.query(
        `UPDATE integration.cbs_batch
         SET state = 'PUBLISHED', state_reason = NULL, updated_at = clock_timestamp()
         WHERE batch_id = $1::uuid AND state = 'APPROVED'`, [batchId],
      );
      if (publication.rowCount !== 1) throw new Error(`CBS batch ${batchId} publication transition failed`);
      await client.query('COMMIT');
      return positions.rowCount ?? 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
