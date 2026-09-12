import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowApprovalController } from '../../../apps/api/src/workflows/workflow-approval.controller.js';
import { PerformWorkflowApproval } from '../../../src/modules/closing-workflow/application/perform-workflow-approval.js';

const claims = { sub: 'checker-1' };
const runId = '17146c36-a0cb-4e0a-b095-60b67c945eb9';
const correlationId = '65aeb69d-73a7-4f04-9578-5fa8326f654f';

describe('WorkflowApprovalController', () => {
  it('uses the authenticated subject instead of an actor supplied by the client', async () => {
    const transition = vi.fn().mockResolvedValue({ state: 'CONTROLLED' });
    const controller = new WorkflowApprovalController(new PerformWorkflowApproval({ transition }));
    await expect(controller.controlCalculation(
      runId, { justification: 'Contrôle indépendant complet' }, 'workflow-action-0001', correlationId, claims,
    )).resolves.toEqual({ state: 'CONTROLLED' });
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'checker-1' }));
  });

  it('rejects missing idempotency before reaching persistence', async () => {
    const controller = new WorkflowApprovalController(new PerformWorkflowApproval({ transition: vi.fn() }));
    await expect(controller.approveClosing(
      runId, { justification: 'Contrôle indépendant complet' }, undefined, correlationId, claims,
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('utilise l’identité authentifiée pour rejeter avec commentaire', async () => {
    const transition = vi.fn().mockResolvedValue({ state: 'ANOMALY' });
    const controller = new WorkflowApprovalController(new PerformWorkflowApproval({ transition }));
    await expect(controller.rejectClosing(
      runId, { justification: 'Anomalie de rapprochement confirmée' }, 'workflow-rejection-0001', correlationId, claims,
    )).resolves.toEqual({ state: 'ANOMALY' });
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ action: 'REJECT_CLOSING', actorId: 'checker-1' }));
  });
});
