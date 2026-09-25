import { describe, expect, it, vi } from 'vitest';

import { InitiateProfitCalculation, type InitiateCalculationRequest } from '../../../src/modules/profit-calculation/application/initiate-profit-calculation.js';

const request: InitiateCalculationRequest = {
  runId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', poolId: 'POOL-DZD-1',
  businessDate: '2026-08-28', rulesVersion: 'rules-2026.1',
  correlationId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
  requestedBy: 'maker-1',
  participantBasis: { type: 'ACTIVE_SUBSCRIPTIONS', weightBasis: 'LATEST_POSITION' },
};

describe('InitiateProfitCalculation', () => {
  it('delegates a valid request to the repository unchanged', async () => {
    const prepareAndEnqueueAtomically = vi.fn(async () => ({
      runId: request.runId, status: 'DRAFT' as const, dispatchStatus: 'QUEUED' as const,
    }));
    await expect(new InitiateProfitCalculation({ prepareAndEnqueueAtomically }).execute(request)).resolves.toEqual({
      runId: request.runId, status: 'DRAFT', dispatchStatus: 'QUEUED',
    });
    expect(prepareAndEnqueueAtomically).toHaveBeenCalledWith(request);
  });

  it.each([
    ['runId', { ...request, runId: 'not-a-uuid' }],
    ['correlationId', { ...request, correlationId: 'not-a-uuid' }],
    ['poolId', { ...request, poolId: 'lower-case-not-allowed' }],
    ['businessDate', { ...request, businessDate: '28-08-2026' }],
    ['rulesVersion', { ...request, rulesVersion: '   ' }],
    ['requestedBy', { ...request, requestedBy: '' }],
    ['runKind', { ...request, runKind: 'BOGUS' as never }],
    ['participantBasis.type', { ...request, participantBasis: { type: 'BOGUS' as never, weightBasis: 'LATEST_POSITION' as const } }],
    ['participantBasis.weightBasis', { ...request, participantBasis: { type: 'ACTIVE_SUBSCRIPTIONS' as const, weightBasis: 'BOGUS' as never } }],
  ])('rejects an invalid %s without ever reaching the repository', (_field, invalid) => {
    const prepareAndEnqueueAtomically = vi.fn();
    expect(() => new InitiateProfitCalculation({ prepareAndEnqueueAtomically }).execute(invalid)).toThrow(TypeError);
    expect(prepareAndEnqueueAtomically).not.toHaveBeenCalled();
  });

  it('accepts the optional PRODUCTION run kind', async () => {
    const prepareAndEnqueueAtomically = vi.fn(async () => ({
      runId: request.runId, status: 'DRAFT' as const, dispatchStatus: 'QUEUED' as const,
    }));
    await expect(new InitiateProfitCalculation({ prepareAndEnqueueAtomically })
      .execute({ ...request, runKind: 'PRODUCTION' })).resolves.toMatchObject({ status: 'DRAFT' });
  });
});
