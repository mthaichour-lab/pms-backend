import type {
  InvestmentPositionValidationRepository,
  InvestmentPositionValidationResult,
} from '../../modules/cbs-ingestion/application/validate-investment-positions.js';
import type { SqlClient } from './postgres-client.js';

export class PostgresInvestmentPositionValidationRepository implements InvestmentPositionValidationRepository {
  constructor(private readonly database: SqlClient) {}

  async inspect(batchId: string, expectedBusinessDate: string): Promise<InvestmentPositionValidationResult> {
    const result = await this.database.query<{
      row_count: string;
      invalid_business_date_count: string;
      manifest_row_count: number;
      manifest_balance_total: string;
      staged_balance_total: string;
      unknown_currency_count: string;
      unknown_product_count: string;
      invalid_chronology_count: string;
    }>(
      `SELECT count(s.row_number)::text AS row_count,
              count(s.row_number) FILTER (WHERE s.business_date <> $2::date)::text AS invalid_business_date_count,
              b.manifest_row_count, b.manifest_balance_total::text,
              COALESCE(sum(s.balance), 0)::text AS staged_balance_total,
              count(s.row_number) FILTER (WHERE NOT EXISTS (
                SELECT 1 FROM reference.currency_version c WHERE c.currency_code = s.currency_code
                  AND c.valid_from <= s.business_date AND (c.valid_until IS NULL OR c.valid_until > s.business_date)
              ))::text AS unknown_currency_count,
              count(s.row_number) FILTER (WHERE NOT EXISTS (
                SELECT 1 FROM product.investment_product p WHERE p.product_code = s.product_code AND p.status = 'PUBLISHED'
              ))::text AS unknown_product_count,
              count(s.row_number) FILTER (WHERE s.opened_on > s.value_date OR s.value_date > s.business_date)::text AS invalid_chronology_count
       FROM integration.cbs_batch b
       LEFT JOIN integration.cbs_investment_position_staging s ON s.batch_id = b.batch_id
       WHERE b.batch_id = $1::uuid
       GROUP BY b.manifest_row_count, b.manifest_balance_total`,
      [batchId, expectedBusinessDate],
    );
    return {
      rowCount: Number(result.rows[0]?.row_count ?? 0),
      invalidBusinessDateCount: Number(result.rows[0]?.invalid_business_date_count ?? 0),
      manifestRowCount: result.rows[0]?.manifest_row_count ?? 0,
      manifestBalanceTotal: result.rows[0]?.manifest_balance_total ?? '0',
      stagedBalanceTotal: result.rows[0]?.staged_balance_total ?? '0',
      unknownCurrencyCount: Number(result.rows[0]?.unknown_currency_count ?? 0),
      unknownProductCount: Number(result.rows[0]?.unknown_product_count ?? 0),
      invalidChronologyCount: Number(result.rows[0]?.invalid_chronology_count ?? 0),
    };
  }

  async quarantineInvalidRows(batchId: string, expectedBusinessDate: string): Promise<number> {
    const result = await this.database.query(
      `WITH row_issues AS (
       INSERT INTO integration.cbs_data_quality_issue (batch_id, row_number, control_code, severity, details)
       SELECT s.batch_id, s.row_number, issue.control_code, 'ERROR', '{}'::jsonb
       FROM integration.cbs_investment_position_staging s
       CROSS JOIN LATERAL (VALUES
         ('BUSINESS_DATE_MISMATCH', s.business_date <> $2::date),
         ('UNKNOWN_CURRENCY', NOT EXISTS (SELECT 1 FROM reference.currency_version c WHERE c.currency_code = s.currency_code AND c.valid_from <= s.business_date AND (c.valid_until IS NULL OR c.valid_until > s.business_date))),
         ('UNKNOWN_PRODUCT', NOT EXISTS (SELECT 1 FROM product.investment_product p WHERE p.product_code = s.product_code AND p.status = 'PUBLISHED')),
         ('INVALID_DATE_CHRONOLOGY', s.opened_on > s.value_date OR s.value_date > s.business_date)
       ) issue(control_code, failed)
       WHERE s.batch_id = $1::uuid AND issue.failed
       ON CONFLICT DO NOTHING
       RETURNING 1
       ), batch_issues AS (
       INSERT INTO integration.cbs_data_quality_issue (batch_id, row_number, control_code, severity, details)
       SELECT b.batch_id, NULL, issue.control_code, 'ERROR', issue.details
       FROM integration.cbs_batch b
       LEFT JOIN integration.cbs_investment_position_staging s ON s.batch_id = b.batch_id
       CROSS JOIN LATERAL (VALUES
         ('EMPTY_BATCH', count(s.row_number) = 0, '{}'::jsonb),
         ('MANIFEST_ROW_COUNT_MISMATCH', count(s.row_number) <> b.manifest_row_count,
          jsonb_build_object('expected', b.manifest_row_count, 'actual', count(s.row_number))),
         ('MANIFEST_BALANCE_MISMATCH', COALESCE(sum(s.balance), 0) <> b.manifest_balance_total,
          jsonb_build_object('expected', b.manifest_balance_total, 'actual', COALESCE(sum(s.balance), 0)))
       ) issue(control_code, failed, details)
       WHERE b.batch_id = $1::uuid
       GROUP BY b.batch_id, b.manifest_row_count, b.manifest_balance_total, issue.control_code, issue.failed, issue.details
       HAVING issue.failed
       ON CONFLICT DO NOTHING
       RETURNING 1
       ) SELECT (SELECT count(*) FROM row_issues) + (SELECT count(*) FROM batch_issues) AS inserted_count`, [batchId, expectedBusinessDate],
    );
    return Number((result.rows[0] as { inserted_count?: string } | undefined)?.inserted_count ?? 0);
  }

  async recordDecision(
    batchId: string,
    decision: 'VALIDATED' | 'REJECTED',
    reason?: string,
  ): Promise<void> {
    const result = await this.database.query(
      `UPDATE integration.cbs_batch
       SET state = $2, state_reason = $3, updated_at = clock_timestamp()
       WHERE batch_id = $1::uuid AND state IN ('STAGED', $2)`,
      [batchId, decision, reason ?? null],
    );
    if (result.rowCount !== 1) throw new Error(`CBS batch ${batchId} is not staged`);
  }
}
