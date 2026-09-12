import { describe, expect, it, vi } from 'vitest';

import { PerformWorkflowApproval } from '../../../src/modules/closing-workflow/application/perform-workflow-approval.js';

describe('PerformWorkflowApproval', () => {
  it('passes a normalized sensitive command to the transaction boundary', async () => {
    const transition = vi.fn().mockResolvedValue({ state: 'CONTROLLED' });
    const useCase = new PerformWorkflowApproval({ transition });
    await expect(useCase.execute({
      action: 'CONTROL_CALCULATION', resourceId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
      actorId: 'checker-1', justification: '  Contrôle des invariants effectué  ',
      idempotencyKey: 'workflow-action-0001',
      correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
    })).resolves.toEqual({ state: 'CONTROLLED' });
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({
      justification: 'Contrôle des invariants effectué',
    }));
  });

  it('rejects insufficient justifications before persistence', () => {
    const useCase = new PerformWorkflowApproval({ transition: vi.fn() });
    expect(() => useCase.execute({
      action: 'APPROVE_CLOSING', resourceId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
      actorId: 'checker-1', justification: 'ok', idempotencyKey: 'workflow-action-0001',
      correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
    })).toThrow('10 characters');
  });

  it('transmet un rejet commenté sans exposer de mutation du résultat', async () => {
    const transition = vi.fn().mockResolvedValue({ state: 'ANOMALY' });
    const useCase = new PerformWorkflowApproval({ transition });
    await expect(useCase.execute({
      action: 'REJECT_CLOSING', resourceId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', actorId: 'checker-2',
      justification: 'Rapprochement non justifié', idempotencyKey: 'workflow-rejection-0001',
      correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
    })).resolves.toEqual({ state: 'ANOMALY' });
    expect(transition).toHaveBeenCalledWith(expect.not.objectContaining({ result: expect.anything() }));
  });
});
