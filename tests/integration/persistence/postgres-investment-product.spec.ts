import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { PostgresInvestmentProductRepository } from '../../../src/infrastructure/persistence/postgres-investment-product.repository.js';

const persisted = {
  product_id: '550e8400-e29b-41d4-a716-446655440001', product_code: 'WAKALA_01',
  product_name: 'Wakala standard', investor_nisba: '75.000000', bank_nisba: '25.000000',
  sharia_reference: 'FATWA-01', validated_by: null, status: 'DRAFT' as const,
};

describe('PostgresInvestmentProductRepository idempotency', () => {
  it('locks and rechecks a command in the mutation transaction before inserting', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('JOIN product.investment_product')) return { rows: [{ ...persisted, request_hash: 'a'.repeat(64) }] };
      return { rows: [] };
    });
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const repository = new PostgresInvestmentProductRepository({ connect: async () => client } as unknown as Pool);
    const replay = await repository.create({ productId: persisted.product_id, code: 'OTHER', name: 'Not inserted', investorNisba: '60', bankNisba: '40', status: 'DRAFT' }, 'maker', { idempotencyKey: 'create-0001', requestHash: 'a'.repeat(64), operation: 'CREATE' });

    expect(replay.productId).toBe(persisted.product_id);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('pg_advisory_xact_lock'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO product.investment_product'))).toBe(false);
    expect((client.release as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
  });
});
