import { describe, expect, it, vi } from 'vitest';

import { PostgresWorkflowApprovalRepository } from '../../../src/infrastructure/persistence/postgres-workflow-approval.repository.js';

const command = {
  action: 'CONTROL_CALCULATION' as const,
  resourceId: 'e958fe1c-6f30-45fa-9819-2239dc953957',
  actorId: 'controller-1',
  justification: 'Calculation controls completed',
  idempotencyKey: 'workflow-control-0001',
  correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
  sessionId: 'session-1',
};

describe('PostgresWorkflowApprovalRepository audit outbox', () => {
  it('writes the AsyncAPI audit intent in the workflow transaction before commit', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.includes('FROM workflow.approval_action')) return { rows: [] };
      if (sql.includes('FROM calculation.run')) {
        return { rows: [{ status: 'CALCULATED', maker_id: 'maker-1', controller_id: null, run_kind: 'SIMULATION', business_date: '2026-09-08' }] };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const repository = new PostgresWorkflowApprovalRepository({ connect: async () => ({ query, release }) } as never);

    await expect(repository.transition(command)).resolves.toEqual({ state: 'CONTROLLED' });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    const outboxIndex = statements.findIndex((sql) => sql.includes('INSERT INTO integration.outbox_event'));
    const commitIndex = statements.indexOf('COMMIT');
    expect(statements[0]).toBe('BEGIN');
    expect(statements[1]).toContain('pg_advisory_xact_lock');
    expect(outboxIndex).toBeGreaterThan(0);
    expect(commitIndex).toBeGreaterThan(outboxIndex);

    const outboxCall = query.mock.calls[outboxIndex]!;
    expect(outboxCall[0]).toContain("'pms.audit.workflow-action-recorded.v1'");
    for (const requiredField of ['resourceType', 'resourceId', 'action', 'actorId', 'justification', 'resultState', 'businessDate']) {
      expect(outboxCall[0], `missing AsyncAPI payload field ${requiredField}`).toContain(`'${requiredField}'`);
    }
    expect(outboxCall[1]).toEqual([
      'CalculationRun', command.resourceId, command.correlationId, command.action,
      command.actorId, command.justification, 'CONTROLLED', '2026-09-08', command.sessionId,
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('commits an identical replay without emitting a second audit intent', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => sql.includes('FROM workflow.approval_action')
      ? { rows: [{ resource_id: command.resourceId, action: command.action, actor_id: command.actorId, justification: command.justification, result_state: 'CONTROLLED' }] }
      : { rows: [], rowCount: 1 });
    const release = vi.fn();
    const repository = new PostgresWorkflowApprovalRepository({ connect: async () => ({ query, release }) } as never);

    await expect(repository.transition(command)).resolves.toEqual({ state: 'CONTROLLED' });
    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual(['BEGIN', expect.stringContaining('pg_advisory_xact_lock'), expect.stringContaining('FROM workflow.approval_action'), 'COMMIT']);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO integration.outbox_event'))).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

  it('does not attempt rollback when BEGIN fails', async () => {
    const query = vi.fn().mockRejectedValueOnce(new Error('connection closed'));
    const release = vi.fn();
    const repository = new PostgresWorkflowApprovalRepository({ connect: async () => ({ query, release }) } as never);

    await expect(repository.transition(command)).rejects.toThrow('connection closed');
    expect(query).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });
});
