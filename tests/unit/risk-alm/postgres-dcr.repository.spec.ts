import { describe, expect, it, vi } from 'vitest';

import { PostgresDcrRepository } from '../../../src/infrastructure/persistence/postgres-dcr.repository.js';
import type { CalculateDcrCommand } from '../../../src/modules/risk-alm/application/calculate-dcr.js';
import { calculateDcr } from '../../../src/modules/risk-alm/domain/dcr.js';

const command: CalculateDcrCommand = {
  poolId: 'POOL-001', businessDate: '2026-09-14', currency: 'DZD', capitalDurationAmount: '125.00',
  riskWeightedDurationAmount: '100.00', threshold: '1.2', formulaVersion: 'dcr-2.1',
  inputChecksumSha256: 'b'.repeat(64), actorId: 'analyst',
};

describe('PostgresDcrRepository', () => {
  it('locks the idempotency identity and returns a newly committed calculation', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reference.currency_version')) return { rows: [{ amount_scale: 2 }] };
      if (sql.includes('INSERT INTO risk.dcr_calculation')) return { rows: [{ dcr_calculation_id: 'new-id' }] };
      return { rows: [] };
    });
    const release = vi.fn();
    const repository = new PostgresDcrRepository({ connect: async () => ({ query, release }) } as never);

    await expect(repository.calculateAtomically(command, calculateDcr)).resolves.toEqual({
      dcrCalculationId: 'new-id', value: '1.250000', threshold: '1.200000', state: 'WITHIN_LIMIT',
    });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ');
    expect(statements[1]).toContain('pg_advisory_xact_lock');
    expect(statements.at(-1)).toBe('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('returns the persisted snapshot for a compatible replay', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reference.currency_version')) return { rows: [{ amount_scale: 2 }] };
      if (sql.includes('INSERT INTO risk.dcr_calculation')) return { rows: [] };
      if (sql.includes('FROM risk.dcr_calculation')) return { rows: [{ dcr_calculation_id: 'existing-id', dcr_value: '1.240000', threshold: '1.200000', state: 'WITHIN_LIMIT' }] };
      return { rows: [] };
    });
    const repository = new PostgresDcrRepository({ connect: async () => ({ query, release: vi.fn() }) } as never);

    await expect(repository.calculateAtomically(command, calculateDcr)).resolves.toEqual({
      dcrCalculationId: 'existing-id', value: '1.240000', threshold: '1.200000', state: 'WITHIN_LIMIT',
    });
  });

  it('rolls back a divergent replay but not a failed BEGIN', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reference.currency_version')) return { rows: [{ amount_scale: 2 }] };
      if (sql.includes('INSERT INTO risk.dcr_calculation')) return { rows: [] };
      return { rows: [] };
    });
    const repository = new PostgresDcrRepository({ connect: async () => ({ query, release: vi.fn() }) } as never);
    await expect(repository.calculateAtomically(command, calculateDcr)).rejects.toThrow('replay payload differs');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');

    const beginQuery = vi.fn(async () => { throw new Error('database unavailable'); });
    const beginRepository = new PostgresDcrRepository({ connect: async () => ({ query: beginQuery, release: vi.fn() }) } as never);
    await expect(beginRepository.calculateAtomically(command, calculateDcr)).rejects.toThrow('database unavailable');
    expect(beginQuery).toHaveBeenCalledTimes(1);
  });
});
