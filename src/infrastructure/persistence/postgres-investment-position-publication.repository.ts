import type { Pool } from 'pg';

import type { InvestmentPositionPublicationRepository } from '../../modules/cbs-ingestion/application/publish-investment-positions.js';

export class PostgresInvestmentPositionPublicationRepository implements InvestmentPositionPublicationRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async isPublished(batchId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try { const result = await client.query<{ state: string }>(`SELECT state FROM integration.cbs_batch WHERE batch_id = $1::uuid`, [batchId]); return result.rows[0]?.state === 'PUBLISHED'; }
    finally { client.release(); }
  }

  async customerReferences(batchId: string): Promise<readonly string[]> {
    const result = await this.pool.connect();
    try { const rows = await result.query<{ customer_reference: string }>(`SELECT DISTINCT customer_reference FROM integration.cbs_investment_position_staging WHERE batch_id = $1::uuid ORDER BY customer_reference`, [batchId]); return rows.rows.map(row => row.customer_reference); }
    finally { result.release(); }
  }

  async publish(batchId: string, tokensByReference: ReadonlyMap<string, string>): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [batchId]);
      const current = await client.query<{ state: string }>(`SELECT state FROM integration.cbs_batch WHERE batch_id = $1::uuid FOR UPDATE`, [batchId]);
      if (current.rows[0]?.state === 'PUBLISHED') { await client.query('COMMIT'); return 0; }
      const approval = await client.query(
        `UPDATE integration.cbs_batch
         SET state = 'APPROVED', state_reason = 'AUTO_QUALITY_CONTROLS', updated_at = clock_timestamp()
         WHERE batch_id = $1::uuid AND state IN ('VALIDATED', 'APPROVED')`, [batchId],
      );
      if (approval.rowCount !== 1) throw new Error(`CBS batch ${batchId} is not validated`);
      for (const [reference, token] of tokensByReference) {
        if (!/^tok_[A-Za-z0-9_-]{16,128}$/.test(token)) throw new TypeError('Invalid customer token for publication');
        await client.query(`UPDATE integration.cbs_investment_position_staging SET customer_token = $3, tokenized_at = clock_timestamp() WHERE batch_id = $1::uuid AND customer_reference = $2`, [batchId, reference, token]);
      }
      const untokenized = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM integration.cbs_investment_position_staging WHERE batch_id = $1::uuid AND customer_token IS NULL`, [batchId]);
      if (Number(untokenized.rows[0]?.count ?? 0) > 0) throw new Error('CBS publication contains untokenized customers');
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
      await client.query(
        `UPDATE integration.cbs_investment_position_staging SET customer_reference = NULL
         WHERE batch_id = $1::uuid AND customer_token IS NOT NULL`, [batchId],
      );
      await client.query(
        `INSERT INTO integration.outbox_event (event_id, aggregate_type, aggregate_id, event_type, schema_version, correlation_id, payload, occurred_at)
         SELECT gen_random_uuid(), 'CbsBatch', b.batch_id::text, 'pms.cbs.batch.published.v1', 1, b.batch_id,
                jsonb_build_object('batchId', b.batch_id, 'businessDate', b.business_date, 'flowType', b.flow_type, 'publishedRows', $2::integer), clock_timestamp()
         FROM integration.cbs_batch b WHERE b.batch_id = $1::uuid
         ON CONFLICT DO NOTHING`, [batchId, positions.rowCount ?? 0],
      );
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
