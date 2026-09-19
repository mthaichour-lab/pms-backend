import { describe, expect, it, vi } from 'vitest';

import { CalculateDcr, type DcrRepository } from '../../../src/modules/risk-alm/application/calculate-dcr.js';

const validCommand = {
  poolId: ' POOL-001 ', businessDate: '2026-09-14', currency: 'DZD',
  capitalDurationAmount: '125.00', riskWeightedDurationAmount: '100.00', threshold: '1.2',
  formulaVersion: 'dcr-2.1', inputChecksumSha256: 'b'.repeat(64), actorId: ' analyst ',
};

describe('CalculateDcr', () => {
  it('rejects impossible dates and database-incompatible precision before persistence', () => {
    const repository = { calculateAtomically: vi.fn() } as unknown as DcrRepository;
    const service = new CalculateDcr(repository);

    expect(() => service.execute({ ...validCommand, businessDate: '2026-02-30' })).toThrow('valid YYYY-MM-DD');
    expect(() => service.execute({ ...validCommand, capitalDurationAmount: '1.1234567890123' })).toThrow('at most 12 decimals');
    expect(repository.calculateAtomically).not.toHaveBeenCalled();
  });

  it('normalizes identifiers before delegating to persistence', async () => {
    const calculateAtomically = vi.fn<DcrRepository['calculateAtomically']>(async () => ({
      dcrCalculationId: 'dcr-id', value: '1.250000', threshold: '1.200000', state: 'WITHIN_LIMIT',
    }));
    const service = new CalculateDcr({ calculateAtomically });

    await service.execute(validCommand);

    expect(calculateAtomically.mock.calls[0]?.[0]).toMatchObject({ poolId: 'POOL-001', actorId: 'analyst' });
  });
});
