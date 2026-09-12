import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CalculationsController } from '../../../apps/api/src/calculations/calculations.controller.js';
import { GetCalculationRun } from '../../../src/modules/profit-calculation/application/get-calculation-run.js';

const runId = '17146c36-a0cb-4e0a-b095-60b67c945eb9';

describe('CalculationsController', () => {
  const controller = new CalculationsController(new GetCalculationRun({
    findById: async (id) => id === runId ? {
      runId, poolId: 'POOL-1', businessDate: '2026-08-28', rulesVersion: 'v1',
      engineVersion: 'pms-engine/0.1.0', status: 'CALCULATED',
      inputChecksumSha256: 'a'.repeat(64), outputChecksumSha256: 'b'.repeat(64),
      distributableAmount: '10.000000000000', currency: 'DZD', allocations: [],
    } : undefined,
  }));

  it('returns a calculation proof without exposing its internal snapshot', async () => {
    await expect(controller.getCalculation(runId)).resolves.toMatchObject({ status: 'CALCULATED' });
  });

  it('maps invalid and absent run identifiers', async () => {
    await expect(controller.getCalculation('invalid')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getCalculation('a1d817e4-657f-475f-a96a-7eecb8f93acc')).rejects.toBeInstanceOf(NotFoundException);
  });
});
