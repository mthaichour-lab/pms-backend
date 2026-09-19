import { describe, expect, it, vi } from 'vitest';
import { AdvanceClosingWorkflow } from '../../../src/modules/closing-workflow/application/advance-closing-workflow.js';
import { EvaluateClosingRequest } from '../../../src/modules/closing-workflow/application/evaluate-closing-request.js';

const closingId = '550e8400-e29b-41d4-a716-446655440001';
const correlationId = '550e8400-e29b-41d4-a716-446655440002';

describe('closing workflow validation', () => {
  it('normalizes requester and correlation and rejects impossible dates', async () => {
    const evaluateAndRecord = vi.fn(async () => ({ state: 'CONTROLS_PASSED' as const, blockers: [] }));
    const useCase = new EvaluateClosingRequest({ evaluateAndRecord });
    await useCase.execute({ closingId, businessDate: '2026-09-14', requestedBy: ' operator ', correlationId: correlationId.toUpperCase() });
    expect(evaluateAndRecord).toHaveBeenCalledWith(expect.objectContaining({ requestedBy: 'operator', correlationId }), expect.any(Function));
    expect(() => useCase.execute({ closingId, businessDate: '2026-02-30', requestedBy: 'operator', correlationId })).toThrow('business date');
    expect(() => useCase.execute({ closingId, businessDate: '2026-09-14', requestedBy: 'operator', correlationId: 'invalid' })).toThrow('correlation identifier');
  });

  it('trims actors and rejects unsafe idempotency keys before persistence', async () => {
    const advanceAtomically = vi.fn(async () => ({ currentStep: 'SCOPE_FREEZE' as const, status: 'DRAFT' as const, stepNumber: 2, previousStep: 'PERIOD_OPENING' as const }));
    const useCase = new AdvanceClosingWorkflow({ advanceAtomically });
    await useCase.execute({ closingId, targetStep: 'SCOPE_FREEZE', actorId: ' operator ', evidence: { qualityControlsGreen: true, blockingAnomalyIds: [], acceptedRiskReferences: [] }, idempotencyKey: ' closing-command-0001 ' });
    const calls = advanceAtomically.mock.calls as unknown as Array<[Record<string, unknown>]>;
    expect(calls[0]?.[0]).toEqual(expect.objectContaining({ actorId: 'operator', idempotencyKey: 'closing-command-0001' }));
    expect(() => useCase.execute({ closingId, targetStep: 'SCOPE_FREEZE', actorId: 'operator', evidence: { qualityControlsGreen: true, blockingAnomalyIds: [], acceptedRiskReferences: [] }, idempotencyKey: 'unsafe key' })).toThrow('safe characters');
  });
});
