import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { RegulatoryReportRepository } from '../../modules/reporting/application/manage-regulatory-report.js';
import type { RegulatoryReportSnapshot } from '../../modules/reporting/domain/regulatory-report.js';
import { assertPublishableReport, validateRegulatoryReport } from '../../modules/reporting/domain/regulatory-report.js';

export class PostgresRegulatoryReportRepository implements RegulatoryReportRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async generate(input: { reportType: string; period: string; actorId: string }, validate: typeof validateRegulatoryReport) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const [runs, reconciliations, dcr, sharia] = await Promise.all([
        client.query<{ id: string }>(
          `SELECT run_id::text AS id FROM calculation.run
           WHERE status = 'POSTED' AND to_char(business_date, 'YYYY-MM') = $1 ORDER BY run_id`, [input.period]),
        client.query<{ id: string; state: string }>(
          `SELECT reconciliation_id::text AS id, state FROM accounting.reconciliation
           WHERE to_char(business_date, 'YYYY-MM') = $1 ORDER BY reconciliation_id`, [input.period]),
        client.query<{ id: string; state: string }>(
          `SELECT dcr_calculation_id::text AS id, state FROM risk.dcr_calculation
           WHERE to_char(business_date, 'YYYY-MM') = $1 ORDER BY dcr_calculation_id`, [input.period]),
        client.query<{ id: string; status: string }>(
          `SELECT review_id::text AS id, status FROM compliance.sharia_review
           WHERE decided_at IS NOT NULL AND to_char(decided_at AT TIME ZONE 'UTC', 'YYYY-MM') = $1 ORDER BY review_id`, [input.period]),
      ]);
      const snapshot = validate({
        period: input.period,
        postedCalculationCount: runs.rowCount ?? runs.rows.length,
        reconciliationVarianceCount: reconciliations.rows.filter((row) => row.state === 'VARIANCE').length,
        dcrBreachCount: dcr.rows.filter((row) => row.state === 'BREACH').length,
        approvedShariaReviewCount: sharia.rows.filter((row) => row.status === 'APPROVED').length,
        rejectedShariaReviewCount: sharia.rows.filter((row) => row.status === 'REJECTED').length,
      });
      const sources = {
        calculationRunIds: runs.rows.map((row) => row.id),
        reconciliations: reconciliations.rows,
        dcrCalculations: dcr.rows,
        shariaReviews: sharia.rows,
      };
      const sourceChecksumSha256 = sha256(canonicalJson(sources));
      const outputChecksumSha256 = sha256(canonicalJson(snapshot));
      await client.query('COMMIT');

      const inserted = await this.pool.connect();
      try {
        const result = await inserted.query<{ regulatory_report_id: string }>(
          `INSERT INTO compliance.regulatory_report
             (report_type, period, status, snapshot, source_checksum_sha256,
              output_checksum_sha256, generated_by)
           VALUES ($1, $2, 'GENERATED', $3::jsonb, $4, $5, $6)
           ON CONFLICT (report_type, period, source_checksum_sha256) DO NOTHING
           RETURNING regulatory_report_id::text`,
          [input.reportType, input.period, JSON.stringify(snapshot), sourceChecksumSha256, outputChecksumSha256, input.actorId],
        );
        let regulatoryReportId = result.rows[0]?.regulatory_report_id;
        if (!regulatoryReportId) {
          const replay = await inserted.query<{ regulatory_report_id: string; output_checksum_sha256: string }>(
            `SELECT regulatory_report_id::text, output_checksum_sha256 FROM compliance.regulatory_report
             WHERE report_type = $1 AND period = $2 AND source_checksum_sha256 = $3`,
            [input.reportType, input.period, sourceChecksumSha256],
          );
          if (!replay.rows[0] || replay.rows[0].output_checksum_sha256 !== outputChecksumSha256) {
            throw new Error('Regulatory report replay output differs');
          }
          regulatoryReportId = replay.rows[0].regulatory_report_id;
        }
        return { regulatoryReportId, state: 'GENERATED' as const, snapshot, sourceChecksumSha256, outputChecksumSha256 };
      } finally { inserted.release(); }
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); }
  }

  async publish(input: {
    regulatoryReportId: string; actorId: string; evidenceDocumentId: string;
    justification: string; idempotencyKey: string;
  }, assertPublishable: typeof assertPublishableReport) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const replay = await client.query<{ resource_id: string; actor_id: string; justification: string }>(
        `SELECT resource_id, actor_id, justification FROM workflow.approval_action
         WHERE idempotency_key = $1 AND action = 'PUBLISH_REGULATORY_REPORT'`, [input.idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].resource_id !== input.regulatoryReportId || replay.rows[0].actor_id !== input.actorId || replay.rows[0].justification !== input.justification) {
          throw new Error('Idempotency key was already used for another report publication');
        }
        await client.query('COMMIT');
        return { regulatoryReportId: input.regulatoryReportId, state: 'PUBLISHED' as const };
      }
      const current = await client.query<{ status: 'GENERATED' | 'PUBLISHED'; generated_by: string }>(
        `SELECT status, generated_by FROM compliance.regulatory_report
         WHERE regulatory_report_id = $1::uuid FOR UPDATE`, [input.regulatoryReportId],
      );
      if (!current.rows[0]) throw new Error('Regulatory report not found');
      assertPublishable({
        state: current.rows[0].status, generatorId: current.rows[0].generated_by,
        publisherId: input.actorId, evidenceDocumentId: input.evidenceDocumentId,
      });
      await client.query(
        `UPDATE compliance.regulatory_report SET status = 'PUBLISHED', evidence_document_id = $2::uuid,
           published_by = $3, published_at = clock_timestamp() WHERE regulatory_report_id = $1::uuid`,
        [input.regulatoryReportId, input.evidenceDocumentId, input.actorId],
      );
      await client.query(
        `INSERT INTO workflow.approval_action
          (idempotency_key, resource_type, resource_id, action, actor_id, justification, result_state)
         VALUES ($1, 'RegulatoryReport', $2, 'PUBLISH_REGULATORY_REPORT', $3, $4, 'PUBLISHED')`,
        [input.idempotencyKey, input.regulatoryReportId, input.actorId, input.justification],
      );
      await client.query('COMMIT');
      return { regulatoryReportId: input.regulatoryReportId, state: 'PUBLISHED' as const };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
