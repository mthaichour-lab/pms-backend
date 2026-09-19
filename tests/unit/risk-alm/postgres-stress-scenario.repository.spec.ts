import { describe, expect, it, vi } from 'vitest';

import { PostgresStressScenarioRepository } from '../../../src/infrastructure/persistence/postgres-stress-scenario.repository.js';
import type { RunStressScenarioCommand } from '../../../src/modules/risk-alm/application/run-stress-scenario.js';
import { executeStressScenario } from '../../../src/modules/risk-alm/domain/stress-scenario.js';

const command: RunStressScenarioCommand = {
  scenarioCode: 'LIQUIDITY_DOWN', businessDate: '2026-09-14', currency: 'DZD', baseAmount: '100.00',
  shocks: [{ bucket: 'SHORT_TERM', basisPoints: -100 }], engineVersion: 'risk-2.1',
  inputChecksumSha256: 'a'.repeat(64), actorId: 'risk-analyst',
};
const persistedResults = [{ bucket: 'SHORT_TERM', basisPoints: -100, stressedAmount: '99.00', impactAmount: '-1.00' }];

describe('PostgresStressScenarioRepository', () => {
  it('serializes identical commands and commits a newly inserted scenario', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('currency_version')) return { rows: [{ amount_scale: 2 }] };
      if (sql.includes('INSERT INTO risk.stress_scenario')) return { rows: [{ stress_scenario_id: 'new-id' }] };
      return { rows: [] };
    });
    const release = vi.fn();
    const repository = new PostgresStressScenarioRepository({ connect: async () => ({ query, release }) } as never);

    await expect(repository.runAtomically(command, executeStressScenario)).resolves.toMatchObject({ stressScenarioId: 'new-id' });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ');
    expect(statements[1]).toContain('pg_advisory_xact_lock');
    expect(statements.at(-1)).toBe('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('returns the persisted result snapshot on replay', async () => {
    // PostgreSQL jsonb does not preserve the original object-key order.
    const parameters = { shocks: command.shocks, baseAmount: command.baseAmount, currency: command.currency };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('currency_version')) return { rows: [{ amount_scale: 2 }] };
      if (sql.includes('INSERT INTO risk.stress_scenario')) return { rows: [] };
      if (sql.includes('FROM risk.stress_scenario')) return { rows: [{ stress_scenario_id: 'existing-id', parameters, results: persistedResults, created_by: command.actorId }] };
      return { rows: [] };
    });
    const repository = new PostgresStressScenarioRepository({ connect: async () => ({ query, release: vi.fn() }) } as never);

    await expect(repository.runAtomically(command, executeStressScenario)).resolves.toEqual({
      stressScenarioId: 'existing-id', state: 'COMPLETED', results: persistedResults,
    });
  });

  it('rejects a replay owned by another actor and rolls back', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('currency_version')) return { rows: [{ amount_scale: 2 }] };
      if (sql.includes('INSERT INTO risk.stress_scenario')) return { rows: [] };
      if (sql.includes('FROM risk.stress_scenario')) return { rows: [{ stress_scenario_id: 'existing-id', parameters: {}, results: persistedResults, created_by: 'other' }] };
      return { rows: [] };
    });
    const release = vi.fn();
    const repository = new PostgresStressScenarioRepository({ connect: async () => ({ query, release }) } as never);

    await expect(repository.runAtomically(command, executeStressScenario)).rejects.toThrow('replay payload differs');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  it('does not roll back when beginning the transaction fails', async () => {
    const query = vi.fn(async () => { throw new Error('database unavailable'); });
    const release = vi.fn();
    const repository = new PostgresStressScenarioRepository({ connect: async () => ({ query, release }) } as never);

    await expect(repository.runAtomically(command, executeStressScenario)).rejects.toThrow('database unavailable');
    expect(query).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledOnce();
  });
});
