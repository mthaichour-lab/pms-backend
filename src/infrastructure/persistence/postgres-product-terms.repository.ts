import type { Pool, PoolClient } from 'pg';
import type { ProductTermsCommand, ProductTermsDraftInput, ProductTermsRepository } from '../../modules/products/application/manage-product-terms.js';
import type { ProductTermsState } from '../../modules/products/domain/product-terms-version.js';

export class PostgresProductTermsRepository implements ProductTermsRepository {
  constructor(private readonly pool: Pool) {}

  async listByProduct(productId: string): Promise<ProductTermsState[]> {
    const result = await this.pool.query<TermsRow>(`${selectTerms} WHERE product_id = $1::uuid ORDER BY version DESC`, [productId]);
    return result.rows.map(mapTerms);
  }

  async findIdempotent(idempotencyKey: string, requestHash: string): Promise<ProductTermsState | undefined> {
    const result = await this.pool.query<TermsRow & { request_hash: string }>(
      `SELECT ${termsColumns}, c.request_hash FROM product.terms_command_idempotency c
       JOIN product.terms_version t ON t.terms_version_id = c.terms_version_id
       WHERE c.idempotency_key = $1`, [idempotencyKey]);
    const row = result.rows[0];
    if (!row) return undefined;
    if (row.request_hash !== requestHash) throw new Error('Idempotency-Key was already used for a different product terms command');
    return mapTerms(row);
  }

  async createDraft(input: ProductTermsDraftInput, actorId: string, command: ProductTermsCommand): Promise<ProductTermsState> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const replay = await lockAndFindCommand(client, command);
      if (replay) { await client.query('COMMIT'); return replay; }
      const product = await client.query('SELECT product_id FROM product.investment_product WHERE product_id = $1::uuid FOR UPDATE', [input.productId]);
      if (product.rowCount !== 1) throw new Error(`Investment product not found: ${input.productId}`);
      const inserted = await client.query<TermsRow>(
        `INSERT INTO product.terms_version
          (product_id, version, effective_from, effective_to, investor_nisba, bank_nisba, indicative_target_rate, created_by)
         SELECT $1::uuid, COALESCE(MAX(version), 0) + 1, $2::date, $3::date, $4::numeric, $5::numeric, $6::numeric, $7
         FROM product.terms_version WHERE product_id = $1::uuid
         RETURNING terms_version_id::text, product_id::text, version, effective_from::text, effective_to::text,
                   investor_nisba::text, bank_nisba::text, indicative_target_rate::text, status,
                   simulation_checksum_sha256, retroactive_approval_id, created_by`,
        [input.productId, input.effectiveFrom, input.effectiveTo ?? null, input.investorNisba, input.bankNisba, input.indicativeTargetRate ?? null, actorId],
      );
      await insertCommand(client, inserted.rows[0]!.terms_version_id, command);
      await client.query(
        `INSERT INTO integration.outbox_event
          (event_id, aggregate_type, aggregate_id, event_type, schema_version, correlation_id, payload, occurred_at)
         VALUES (gen_random_uuid(), 'ProductTerms', $1, 'ProductTermsDrafted', 1, gen_random_uuid(), $2::jsonb, clock_timestamp())`,
        [inserted.rows[0]!.terms_version_id, JSON.stringify({ version: inserted.rows[0]!.version, actorId })],
      );
      await client.query('COMMIT'); return mapTerms(inserted.rows[0]!);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async findById(id: string): Promise<ProductTermsState | undefined> {
    const result = await this.pool.query<TermsRow>(`${selectTerms} WHERE terms_version_id = $1::uuid`, [id]);
    return result.rows[0] ? mapTerms(result.rows[0]) : undefined;
  }

  async publish(state: ProductTermsState, actorId: string, justification: string, correlationId: string, command: ProductTermsCommand): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (await lockAndFindCommand(client, command)) { await client.query('COMMIT'); return; }
      if (state.retroactiveApprovalId) await assertRetroactiveApproval(client, state, actorId);
      const updated = await client.query(
        `UPDATE product.terms_version SET status = 'PUBLISHED', simulation_checksum_sha256 = $2,
           retroactive_approval_id = $3, published_at = clock_timestamp()
         WHERE terms_version_id = $1::uuid AND status = 'DRAFT' AND created_by <> $4`,
        [state.termsVersionId, state.simulationChecksumSha256, state.retroactiveApprovalId ?? null, actorId],
      );
      if (updated.rowCount !== 1) throw new Error('Product terms were concurrently modified or checker is not independent');
      await insertCommand(client, state.termsVersionId, command);
      await client.query(
        `INSERT INTO integration.outbox_event
          (event_id, aggregate_type, aggregate_id, event_type, schema_version, correlation_id, payload, occurred_at)
         VALUES (gen_random_uuid(), 'ProductTerms', $1, 'ProductTermsPublished', 1, $2::uuid, $3::jsonb, clock_timestamp())`,
        [state.termsVersionId, correlationId, JSON.stringify({ productId: state.productId, version: state.version, actorId, justification, criticalChange: true })],
      );
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}

const termsColumns = `t.terms_version_id::text, t.product_id::text, t.version, t.effective_from::text,
  t.effective_to::text, t.investor_nisba::text, t.bank_nisba::text, t.indicative_target_rate::text,
  t.status, t.simulation_checksum_sha256, t.retroactive_approval_id, t.created_by`;
const selectTerms = `SELECT terms_version_id::text, product_id::text, version, effective_from::text,
  effective_to::text, investor_nisba::text, bank_nisba::text, indicative_target_rate::text,
  status, simulation_checksum_sha256, retroactive_approval_id, created_by FROM product.terms_version t`;
interface TermsRow { terms_version_id: string; product_id: string; version: number; effective_from: string; effective_to: string | null; investor_nisba: string; bank_nisba: string; indicative_target_rate: string | null; status: ProductTermsState['status']; simulation_checksum_sha256: string | null; retroactive_approval_id: string | null; created_by: string; }
function mapTerms(row: TermsRow): ProductTermsState { return { termsVersionId: row.terms_version_id, productId: row.product_id, version: row.version, effectiveFrom: row.effective_from, effectiveTo: row.effective_to ?? undefined, investorNisba: row.investor_nisba, bankNisba: row.bank_nisba, indicativeTargetRate: row.indicative_target_rate ?? undefined, status: row.status, simulationChecksumSha256: row.simulation_checksum_sha256 ?? undefined, retroactiveApprovalId: row.retroactive_approval_id ?? undefined, createdBy: row.created_by }; }
async function assertRetroactiveApproval(client: PoolClient, state: ProductTermsState, actorId: string): Promise<void> {
  const result = await client.query<{ actor_id: string }>(
    `SELECT actor_id FROM workflow.approval_action WHERE idempotency_key = $1 AND resource_type = 'ProductTerms'
       AND resource_id = $2 AND action = 'APPROVE_RETROACTIVE_PRODUCT_TERMS' AND result_state = 'APPROVED'`, [state.retroactiveApprovalId, state.termsVersionId],
  );
  if (!result.rows[0] || result.rows[0].actor_id === actorId) throw new Error('Valid independent retroactive approval not found');
}
async function insertCommand(client: PoolClient, termsVersionId: string, command: ProductTermsCommand): Promise<void> {
  await client.query(`INSERT INTO product.terms_command_idempotency
    (idempotency_key, request_hash, operation, terms_version_id) VALUES ($1, $2, $3, $4::uuid)`,
    [command.idempotencyKey, command.requestHash, command.operation, termsVersionId]);
}
async function lockAndFindCommand(client: PoolClient, command: ProductTermsCommand): Promise<ProductTermsState | undefined> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [command.idempotencyKey]);
  const result = await client.query<TermsRow & { request_hash: string }>(
    `SELECT ${termsColumns}, c.request_hash FROM product.terms_command_idempotency c
     JOIN product.terms_version t ON t.terms_version_id = c.terms_version_id WHERE c.idempotency_key = $1`,
    [command.idempotencyKey]);
  const row = result.rows[0];
  if (!row) return undefined;
  if (row.request_hash !== command.requestHash) throw new Error('Idempotency-Key was already used for a different product terms command');
  return mapTerms(row);
}
