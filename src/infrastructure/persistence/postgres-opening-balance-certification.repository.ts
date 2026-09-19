import type { Pool, PoolClient } from 'pg';
import type { OpeningBalanceCertificationRepository } from '../../modules/accounting/application/certify-opening-balances.js';
import type { certifyOpeningBalances } from '../../modules/accounting/domain/opening-balance-certification.js';

export class PostgresOpeningBalanceCertificationRepository implements OpeningBalanceCertificationRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async save(certification: ReturnType<typeof certifyOpeningBalances>): Promise<{ status: 'CERTIFIED' }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ certification_id: string; status: 'CERTIFIED'; signed_by: string; evidence_checksum_sha256: string }>(
        `SELECT certification_id::text, status, signed_by, evidence_checksum_sha256
           FROM homologation.opening_balance_certification
          WHERE certification_id = $1::uuid FOR SHARE`, [certification.certificationId],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.evidence_checksum_sha256 !== certification.checksumSha256 || row.signed_by !== certification.signedBy || row.status !== 'CERTIFIED') {
          throw new Error('Opening balance certification replay conflict');
        }
        await client.query('COMMIT');
        return { status: 'CERTIFIED' };
      }
      await client.query(
        `INSERT INTO homologation.opening_balance_certification
          (certification_id, status, signed_by, signed_at, evidence_checksum_sha256)
         VALUES ($1::uuid, 'CERTIFIED', $2, $3::timestamptz, $4)`,
        [certification.certificationId, certification.signedBy, certification.signedAt, certification.checksumSha256],
      );
      for (const line of certification.lines) {
        await client.query(
          `INSERT INTO homologation.opening_balance_reconciliation
            (certification_id, component, currency_code, migrated_amount, general_ledger_amount, difference_amount, evidence_reference)
           VALUES ($1::uuid, $2, $3, $4::numeric, $5::numeric, $6::numeric, $7)`,
          [certification.certificationId, line.component, line.currencyCode, line.migratedAmount,
            line.generalLedgerAmount, line.difference, line.evidenceReference],
        );
      }
      await emit(client, certification.certificationId, certification.checksumSha256, certification.signedBy);
      await client.query('COMMIT');
      return { status: 'CERTIFIED' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function emit(client: PoolClient, certificationId: string, checksum: string, signedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO integration.outbox_event
      (event_id, aggregate_type, aggregate_id, event_type, schema_version, correlation_id, payload, occurred_at)
     VALUES (gen_random_uuid(), 'OpeningBalanceCertification', $1, 'OpeningBalanceCertified.v1', 1,
             gen_random_uuid(), $2::jsonb, clock_timestamp())`,
    [certificationId, JSON.stringify({ certificationId, checksumSha256: checksum, signedBy })],
  );
}
