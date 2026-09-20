import type { InvestmentProductRepository, ProductCommand, ProductListPage, ProductListQuery } from '../../modules/products/application/manage-investment-product.js';
import type { InvestmentProductState, ProductTransition } from '../../modules/products/domain/investment-product.js';
import type { Pool } from 'pg';
import { assertProductPublishable } from './postgres-product-reference.repository.js';

export class PostgresInvestmentProductRepository implements InvestmentProductRepository {
  constructor(private readonly pool: Pool) {}

  async findIdempotent(idempotencyKey: string, requestHash: string): Promise<InvestmentProductState | undefined> {
    const result = await this.pool.query<ProductRow & { request_hash: string }>(
      `SELECT p.product_id::text, p.product_code, p.product_name, p.investor_nisba::text,
              p.bank_nisba::text, p.sharia_reference, p.validated_by, p.status, c.request_hash
       FROM product.command_idempotency c JOIN product.investment_product p ON p.product_id = c.product_id
       WHERE c.idempotency_key = $1`, [idempotencyKey],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    if (row.request_hash !== requestHash) throw new Error('Idempotency-Key was already used for a different product command');
    return mapRow(row);
  }

  async create(state: InvestmentProductState, actorId: string, command: ProductCommand): Promise<InvestmentProductState> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const replay = await lockAndFindCommand(client, command);
      if (replay) { await client.query('COMMIT'); return replay; }
      await client.query(
        `INSERT INTO product.investment_product
         (product_id, product_code, product_name, investor_nisba, bank_nisba, sharia_reference, status)
         VALUES ($1::uuid, $2, $3, $4::numeric, $5::numeric, $6, 'DRAFT')`,
        [state.productId, state.code, state.name, state.investorNisba, state.bankNisba, state.shariaReference ?? null],
      );
      await client.query(
        `INSERT INTO product.product_transition (product_id, from_status, to_status, actor_id, justification)
         VALUES ($1::uuid, 'DRAFT', 'DRAFT', $2, 'Initial product draft creation')`, [state.productId, actorId],
      );
      await insertCommand(client, state.productId, command);
      await client.query('COMMIT');
      return state;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async findById(productId: string): Promise<InvestmentProductState | undefined> {
    const result = await this.pool.query<ProductRow>(`SELECT product_id::text, product_code, product_name, investor_nisba::text, bank_nisba::text,
               sharia_reference, validated_by, status FROM product.investment_product WHERE product_id = $1::uuid`, [productId]);
    const row = result.rows[0];
    return row ? mapRow(row) : undefined;
  }

  async list(input: ProductListQuery): Promise<ProductListPage> {
    const [products, count] = await Promise.all([
      this.pool.query<ProductRow>(
        `SELECT product_id::text, product_code, product_name, investor_nisba::text, bank_nisba::text,
                sharia_reference, validated_by, status
         FROM product.investment_product
         ORDER BY product_code ASC, product_id ASC
         LIMIT $1 OFFSET $2`,
        [input.limit, input.offset],
      ),
      this.pool.query<{ total: string }>('SELECT count(*)::text AS total FROM product.investment_product'),
    ]);
    return { items: products.rows.map(mapRow), total: Number(count.rows[0]?.total ?? 0) };
  }

  async saveTransition(state: InvestmentProductState, transition: ProductTransition, command: ProductCommand): Promise<InvestmentProductState> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const replay = await lockAndFindCommand(client, command);
      if (replay) { await client.query('COMMIT'); return replay; }
      if (transition.toStatus === 'PUBLISHED') await assertProductPublishable(client, state.productId, new Date().toISOString().slice(0, 10));
      const updated = await client.query(
        `UPDATE product.investment_product SET status = $3, validated_by = $4, updated_at = clock_timestamp()
         WHERE product_id = $1::uuid AND status = $2`, [state.productId, transition.fromStatus, transition.toStatus, state.validatedBy ?? null],
      );
      if (updated.rowCount !== 1) throw new Error('Investment product was concurrently modified');
      await client.query(
        `INSERT INTO product.product_transition (product_id, from_status, to_status, actor_id, justification)
         VALUES ($1::uuid, $2, $3, $4, $5)`,
        [state.productId, transition.fromStatus, transition.toStatus, transition.actorId, transition.justification],
      );
      await insertCommand(client, state.productId, command);
      await client.query('COMMIT');
      return state;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}

interface ProductRow {
  product_id: string; product_code: string; product_name: string; investor_nisba: string;
  bank_nisba: string; sharia_reference: string | null; validated_by: string | null; status: InvestmentProductState['status'];
}

function mapRow(row: ProductRow): InvestmentProductState {
  return {
    productId: row.product_id, code: row.product_code, name: row.product_name,
    investorNisba: row.investor_nisba, bankNisba: row.bank_nisba,
    shariaReference: row.sharia_reference ?? undefined, validatedBy: row.validated_by ?? undefined, status: row.status,
  };
}

async function lockAndFindCommand(client: { query<T = unknown>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }> }, command: ProductCommand): Promise<InvestmentProductState | undefined> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [command.idempotencyKey]);
  const result = await client.query<ProductRow & { request_hash: string }>(
    `SELECT p.product_id::text, p.product_code, p.product_name, p.investor_nisba::text,
            p.bank_nisba::text, p.sharia_reference, p.validated_by, p.status, c.request_hash
     FROM product.command_idempotency c JOIN product.investment_product p ON p.product_id = c.product_id
     WHERE c.idempotency_key = $1`, [command.idempotencyKey],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  if (row.request_hash !== command.requestHash) throw new Error('Idempotency-Key was already used for a different product command');
  return mapRow(row);
}

async function insertCommand(client: { query(text: string, values?: readonly unknown[]): Promise<unknown> }, productId: string, command: ProductCommand): Promise<void> {
  await client.query(
    `INSERT INTO product.command_idempotency (idempotency_key, request_hash, operation, product_id)
     VALUES ($1, $2, $3, $4::uuid)`, [command.idempotencyKey, command.requestHash, command.operation, productId],
  );
}
