import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { CalculationsController } from '../../../apps/api/src/calculations/calculations.controller.js';
import { GetCalculationRun, ListCalculationRuns } from '../../../src/modules/profit-calculation/application/get-calculation-run.js';
import {
  CalculationInitiationError,
  InitiateProfitCalculation,
} from '../../../src/modules/profit-calculation/application/initiate-profit-calculation.js';

const runId = '17146c36-a0cb-4e0a-b095-60b67c945eb9';
const correlationId = '65aeb69d-73a7-4f04-9578-5fa8326f654f';

function makeController(options: {
  list?: () => Promise<{ items: never[]; total: number }>;
  prepareAndEnqueueAtomically?: () => Promise<{ runId: string; status: 'DRAFT'; dispatchStatus: 'QUEUED' | 'ALREADY_QUEUED' }>;
} = {}) {
  return new CalculationsController(
    new GetCalculationRun({
      findById: async (id) => id === runId ? {
        runId, poolId: 'POOL-1', businessDate: '2026-08-28', rulesVersion: 'v1',
        engineVersion: 'pms-engine/0.1.0', status: 'CALCULATED',
        inputChecksumSha256: 'a'.repeat(64), outputChecksumSha256: 'b'.repeat(64),
        distributableAmount: '10.000000000000', currency: 'DZD', allocations: [],
      } : undefined,
      list: options.list ?? (async () => ({ items: [], total: 0 })),
    }),
    new ListCalculationRuns({
      findById: async () => undefined,
      list: options.list ?? (async () => ({ items: [], total: 0 })),
    }),
    new InitiateProfitCalculation({
      prepareAndEnqueueAtomically: options.prepareAndEnqueueAtomically
        ?? (async () => ({ runId, status: 'DRAFT', dispatchStatus: 'QUEUED' })),
    }),
  );
}

const initiateBody = {
  runId, poolId: 'POOL-1', businessDate: '2026-08-28', rulesVersion: 'v1',
  participantBasis: { type: 'ACTIVE_SUBSCRIPTIONS' as const, weightBasis: 'LATEST_POSITION' as const },
};

describe('CalculationsController', () => {
  it('returns a calculation proof without exposing its internal snapshot', async () => {
    await expect(makeController().getCalculation(runId)).resolves.toMatchObject({ status: 'CALCULATED' });
  });

  it('maps invalid and absent run identifiers', async () => {
    const controller = makeController();
    await expect(controller.getCalculation('invalid')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getCalculation('a1d817e4-657f-475f-a96a-7eecb8f93acc')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists calculation runs through the query repository', async () => {
    const list = vi.fn(async () => ({ items: [], total: 0 }));
    const controller = makeController({ list });
    await expect(controller.listCalculations('10', '0', 'POOL-1')).resolves.toEqual({ items: [], total: 0 });
    expect(list).toHaveBeenCalledWith({ limit: 10, offset: 0, poolId: 'POOL-1' });
  });

  it('rejects a non-numeric pagination parameter', () => {
    expect(() => makeController().listCalculations('abc')).toThrow(BadRequestException);
  });

  it('initiates a calculation, forwarding the authenticated requester and correlation id', async () => {
    const prepareAndEnqueueAtomically = vi.fn(async () => ({ runId, status: 'DRAFT' as const, dispatchStatus: 'QUEUED' as const }));
    const controller = makeController({ prepareAndEnqueueAtomically });
    await expect(controller.runCalculation(
      initiateBody, correlationId, { sub: 'analyst-1' } as never,
    )).resolves.toEqual({ runId, status: 'DRAFT', dispatchStatus: 'QUEUED' });
    expect(prepareAndEnqueueAtomically).toHaveBeenCalledWith({
      ...initiateBody, requestedBy: 'analyst-1', correlationId,
    });
  });

  it('maps a calculation run conflict to an explicit 409 instead of a 500', async () => {
    const controller = makeController({
      prepareAndEnqueueAtomically: async () => {
        throw new CalculationInitiationError('CALCULATION_RUN_CONFLICT', 'conflict', 'USE_EXISTING_RUN_OR_NEW_REVISION');
      },
    });
    await expect(controller.runCalculation(initiateBody, correlationId, { sub: 'analyst-1' } as never))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
