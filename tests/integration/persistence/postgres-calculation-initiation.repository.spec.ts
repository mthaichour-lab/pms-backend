import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { PostgresCalculationInitiationRepository } from '../../../src/infrastructure/persistence/postgres-calculation-initiation.repository.js';
import { CalculationInitiationError, type InitiateCalculationRequest } from '../../../src/modules/profit-calculation/application/initiate-profit-calculation.js';

const request: InitiateCalculationRequest = {
  runId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', poolId: 'POOL-DZD-1',
  businessDate: '2026-08-28', rulesVersion: 'rules-2026.1',
  correlationId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
  requestedBy: 'maker-1',
  participantBasis: { type: 'ACTIVE_SUBSCRIPTIONS', weightBasis: 'LATEST_POSITION' },
};

/** Builds a `client.query` mock that dispatches on a distinctive SQL fragment; falls through to `defaults`. */
function queryMock(handlers: Record<string, unknown>, defaults: Record<string, unknown> = {}) {
  return vi.fn(async (sql: string, _values?: unknown[]) => {
    for (const [fragment, rows] of Object.entries(handlers)) {
      if (sql.includes(fragment)) return { rows };
    }
    for (const [fragment, rows] of Object.entries(defaults)) {
      if (sql.includes(fragment)) return { rows };
    }
    return { rows: [] };
  });
}

const NO_REPLAY = { 'FROM calculation.run': [] };
const POOL_ACTIVE = { "FROM pooling.pool WHERE pool_id": [{ currency_code: 'DZD' }] };
const NO_EXISTING_PARTICIPANTS = { 'FROM pooling.participant_version participant': [{ total: '0', eligible: '0' }] };
const ONE_ACTIVE_SUBSCRIPTION = {
  'FROM investment.subscription_account subscription': [{ account_id: 'acct-1', weight: '1000' }],
};
const NO_EXISTING_DISTRIBUTABLE_RESULT = { 'FROM pooling.distributable_result': [] };
// "AND NOT EXISTS" uniquely identifies the ungoverned-charges lookup: the bigger
// distributable-result query below also references revenue.pool_charge, so matching on
// that table name alone would make this handler swallow that unrelated query too.
const NO_UNGOVERNED_CHARGES = { 'AND NOT EXISTS': [] };
const POSITIVE_DISTRIBUTABLE = {
  'FROM income CROSS JOIN charges': [{
    income_count: '1', income_amount: '100', charge_amount: '10',
    distributable_amount: '90', source_fingerprint: 'a'.repeat(64),
  }],
};

function connectReturning(query: ReturnType<typeof queryMock>) {
  const release = vi.fn();
  const source = { connect: async () => ({ query, release }), release };
  return source as unknown as Pick<Pool, 'connect'> & { release: typeof release };
}

describe('PostgresCalculationInitiationRepository', () => {
  it('prepares participants, the distributable result and the run atomically on a fresh pool', async () => {
    const query = queryMock({
      ...NO_REPLAY, ...POOL_ACTIVE, ...NO_EXISTING_PARTICIPANTS, ...ONE_ACTIVE_SUBSCRIPTION,
      ...NO_EXISTING_DISTRIBUTABLE_RESULT, ...NO_UNGOVERNED_CHARGES, ...POSITIVE_DISTRIBUTABLE,
    });
    const pool = connectReturning(query);
    const repository = new PostgresCalculationInitiationRepository(pool);

    await expect(repository.prepareAndEnqueueAtomically(request)).resolves.toEqual({
      runId: request.runId, status: 'DRAFT', dispatchStatus: 'QUEUED',
    });

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toBe('BEGIN ISOLATION LEVEL SERIALIZABLE');
    expect(statements[1]).toContain('pg_advisory_xact_lock');
    expect(statements.some(sql => sql.includes('INSERT INTO pooling.participant_version'))).toBe(true);
    expect(statements.some(sql => sql.includes('INSERT INTO pooling.distributable_result'))).toBe(true);
    expect(statements.some(sql => sql.includes('INSERT INTO calculation.run'))).toBe(true);
    expect(statements.some(sql => sql.includes('INSERT INTO integration.outbox_event'))).toBe(true);
    expect(statements.at(-1)).toBe('COMMIT');
    expect(pool.release).toHaveBeenCalledOnce();

    const runInsert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO calculation.run'));
    expect(runInsert?.[1]).toEqual([
      request.runId, request.poolId, request.businessDate, request.rulesVersion,
      request.correlationId, request.requestedBy, 'PARALLEL',
    ]);
  });

  it('skips participant and distributable preparation when both already exist', async () => {
    const query = queryMock({
      ...NO_REPLAY, ...POOL_ACTIVE,
      'FROM pooling.participant_version participant': [{ total: '3', eligible: '3' }],
      'FROM pooling.distributable_result': [{ amount: '90' }],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    await expect(repository.prepareAndEnqueueAtomically(request)).resolves.toMatchObject({ status: 'DRAFT' });

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some(sql => sql.includes('INSERT INTO pooling.participant_version'))).toBe(false);
    expect(statements.some(sql => sql.includes('INSERT INTO pooling.distributable_result'))).toBe(false);
  });

  it('replays an identical prior request without writing anything new', async () => {
    const query = queryMock({
      'FROM calculation.run': [{
        run_id: request.runId, pool_id: request.poolId, business_date: request.businessDate,
        rules_version: request.rulesVersion, correlation_id: request.correlationId,
        maker_id: request.requestedBy, run_kind: 'PARALLEL', status: 'DRAFT',
      }],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    await expect(repository.prepareAndEnqueueAtomically(request)).resolves.toEqual({
      runId: request.runId, status: 'DRAFT', dispatchStatus: 'ALREADY_QUEUED',
    });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements).toEqual(['BEGIN ISOLATION LEVEL SERIALIZABLE', expect.stringContaining('pg_advisory_xact_lock'), expect.stringContaining('FROM calculation.run'), 'COMMIT']);
  });

  it('rejects a conflicting run sharing the same identifier with a different payload, and rolls back', async () => {
    const query = queryMock({
      'FROM calculation.run': [{
        run_id: request.runId, pool_id: request.poolId, business_date: request.businessDate,
        rules_version: request.rulesVersion, correlation_id: 'ffffffff-0000-4000-8000-000000000000',
        maker_id: request.requestedBy, run_kind: 'PARALLEL', status: 'DRAFT',
      }],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    const error = await repository.prepareAndEnqueueAtomically(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CalculationInitiationError);
    expect((error as InstanceType<typeof CalculationInitiationError>).code).toBe('CALCULATION_RUN_CONFLICT');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });

  it('rejects re-queueing a run that already left DRAFT', async () => {
    const query = queryMock({
      'FROM calculation.run': [{
        run_id: request.runId, pool_id: request.poolId, business_date: request.businessDate,
        rules_version: request.rulesVersion, correlation_id: request.correlationId,
        maker_id: request.requestedBy, run_kind: 'PARALLEL', status: 'CALCULATED',
      }],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    const error = await repository.prepareAndEnqueueAtomically(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CalculationInitiationError);
    expect((error as InstanceType<typeof CalculationInitiationError>).code).toBe('CALCULATION_RUN_CONFLICT');
  });

  it('rejects an inactive or missing pool, and rolls back', async () => {
    const query = queryMock({ ...NO_REPLAY, "FROM pooling.pool WHERE pool_id": [] });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    const error = await repository.prepareAndEnqueueAtomically(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CalculationInitiationError);
    expect((error as InstanceType<typeof CalculationInitiationError>).code).toBe('POOL_NOT_ACTIVE');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });

  it('rejects existing pool participants that are not all active, accepted and positively weighted', async () => {
    const query = queryMock({
      ...NO_REPLAY, ...POOL_ACTIVE,
      'FROM pooling.participant_version participant': [{ total: '3', eligible: '2' }],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    const error = await repository.prepareAndEnqueueAtomically(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CalculationInitiationError);
    expect((error as InstanceType<typeof CalculationInitiationError>).code).toBe('PARTICIPANT_BASIS_INVALID');
  });

  it('rejects a pool with no participants and no eligible active subscription', async () => {
    const query = queryMock({
      ...NO_REPLAY, ...POOL_ACTIVE, ...NO_EXISTING_PARTICIPANTS,
      'FROM investment.subscription_account subscription': [],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    const error = await repository.prepareAndEnqueueAtomically(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CalculationInitiationError);
    expect((error as InstanceType<typeof CalculationInitiationError>).code).toBe('PARTICIPANT_BASIS_UNAVAILABLE');
    expect((error as InstanceType<typeof CalculationInitiationError>).requiredAction).toBe('LOAD_INVESTMENT_POSITIONS');
  });

  it('points to recording subscription deposits when the weight basis is the ledger balance', async () => {
    const query = queryMock({
      ...NO_REPLAY, ...POOL_ACTIVE, ...NO_EXISTING_PARTICIPANTS,
      'FROM investment.subscription_account subscription': [],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    const error = await repository.prepareAndEnqueueAtomically({
      ...request, participantBasis: { type: 'ACTIVE_SUBSCRIPTIONS', weightBasis: 'SUBSCRIPTION_LEDGER_BALANCE' },
    }).catch((e: unknown) => e);
    expect((error as InstanceType<typeof CalculationInitiationError>).requiredAction).toBe('RECORD_SUBSCRIPTION_DEPOSITS');
  });

  it('rejects pool charges with no effective accountability policy', async () => {
    const query = queryMock({
      ...NO_REPLAY, ...POOL_ACTIVE, ...NO_EXISTING_PARTICIPANTS, ...ONE_ACTIVE_SUBSCRIPTION,
      ...NO_EXISTING_DISTRIBUTABLE_RESULT,
      'AND NOT EXISTS': [{ source_reference: 'CHG-1' }],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    const error = await repository.prepareAndEnqueueAtomically(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CalculationInitiationError);
    expect((error as InstanceType<typeof CalculationInitiationError>).code).toBe('CHARGE_POLICY_MISSING');
  });

  it('rejects a business date with no realized recognized income', async () => {
    const query = queryMock({
      ...NO_REPLAY, ...POOL_ACTIVE, ...NO_EXISTING_PARTICIPANTS, ...ONE_ACTIVE_SUBSCRIPTION,
      ...NO_EXISTING_DISTRIBUTABLE_RESULT, ...NO_UNGOVERNED_CHARGES,
      'FROM income CROSS JOIN charges': [{ income_count: '0', income_amount: '0', charge_amount: '0', distributable_amount: '0', source_fingerprint: 'a'.repeat(64) }],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    const error = await repository.prepareAndEnqueueAtomically(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CalculationInitiationError);
    expect((error as InstanceType<typeof CalculationInitiationError>).code).toBe('RECOGNIZED_INCOME_UNAVAILABLE');
  });

  it('rejects a non-positive distributable amount', async () => {
    const query = queryMock({
      ...NO_REPLAY, ...POOL_ACTIVE, ...NO_EXISTING_PARTICIPANTS, ...ONE_ACTIVE_SUBSCRIPTION,
      ...NO_EXISTING_DISTRIBUTABLE_RESULT, ...NO_UNGOVERNED_CHARGES,
      'FROM income CROSS JOIN charges': [{ income_count: '1', income_amount: '10', charge_amount: '20', distributable_amount: '-10', source_fingerprint: 'a'.repeat(64) }],
    });
    const repository = new PostgresCalculationInitiationRepository(connectReturning(query));

    const error = await repository.prepareAndEnqueueAtomically(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CalculationInitiationError);
    expect((error as InstanceType<typeof CalculationInitiationError>).code).toBe('DISTRIBUTABLE_AMOUNT_NOT_POSITIVE');
  });

  it('rolls back and releases the client when the database itself fails', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === 'BEGIN ISOLATION LEVEL SERIALIZABLE' || sql.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (sql.includes('FROM calculation.run')) throw new Error('connection terminated');
      return { rows: [] };
    });
    const pool = connectReturning(query);
    const repository = new PostgresCalculationInitiationRepository(pool);

    await expect(repository.prepareAndEnqueueAtomically(request)).rejects.toThrow('connection terminated');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(pool.release).toHaveBeenCalledOnce();
  });
});
