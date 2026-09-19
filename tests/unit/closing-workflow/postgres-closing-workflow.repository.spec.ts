import { describe, expect, it, vi } from 'vitest';

import {
  ClosingIdempotencyConflictError,
  PostgresClosingWorkflowRepository,
} from '../../../src/infrastructure/persistence/postgres-closing-workflow.repository.js';

const command = {
  closingId: '123e4567-e89b-42d3-a456-426614174000',
  targetStep: 'SCOPE_FREEZE' as const,
  actorId: 'finance-controller',
  evidence: { qualityControlsGreen: true, blockingAnomalyIds: [], acceptedRiskReferences: [] },
  idempotencyKey: 'closing-command-0001',
};

describe('PostgresClosingWorkflowRepository', () => {
  it('replays an identical command without evaluating or writing it again', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ resulting_step: 'SCOPE_FREEZE', resulting_status: 'DRAFT', step_number: 2, previous_step: 'PERIOD_OPENING', same_actor: true, same_evidence: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();
    const repository = new PostgresClosingWorkflowRepository({ connect: async () => ({ query, release }) } as never);
    const transition = vi.fn();

    await expect(repository.advanceAtomically(command, transition)).resolves.toMatchObject({ currentStep: 'SCOPE_FREEZE', stepNumber: 2 });
    expect(transition).not.toHaveBeenCalled();
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ resulting_step: 'SCOPE_FREEZE', resulting_status: 'DRAFT', step_number: 2, previous_step: 'PERIOD_OPENING', same_actor: false, same_evidence: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();
    const repository = new PostgresClosingWorkflowRepository({ connect: async () => ({ query, release }) } as never);

    await expect(repository.advanceAtomically(command, vi.fn())).rejects.toBeInstanceOf(ClosingIdempotencyConflictError);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  it('does not issue rollback when BEGIN itself fails', async () => {
    const query = vi.fn().mockRejectedValueOnce(new Error('connection lost'));
    const release = vi.fn();
    const repository = new PostgresClosingWorkflowRepository({ connect: async () => ({ query, release }) } as never);

    await expect(repository.advanceAtomically(command, vi.fn())).rejects.toThrow('connection lost');
    expect(query).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });
});
