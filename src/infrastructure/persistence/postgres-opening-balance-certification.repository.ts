import type { Pool } from 'pg';
import type { OpeningBalanceCertificationRepository } from '../../modules/accounting/application/certify-opening-balances.js';
import type { certifyOpeningBalances } from '../../modules/accounting/domain/opening-balance-certification.js';

export class PostgresOpeningBalanceCertificationRepository implements OpeningBalanceCertificationRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async save(certification: ReturnType<typeof certifyOpeningBalances>): Promise<{ status: 'CERTIFIED' }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
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
