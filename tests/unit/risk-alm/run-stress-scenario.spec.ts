import { describe, expect, it, vi } from 'vitest';

import { RunStressScenario, type StressScenarioRepository } from '../../../src/modules/risk-alm/application/run-stress-scenario.js';

const validCommand = {
  scenarioCode: 'LIQUIDITY_DOWN', businessDate: '2026-09-14', currency: 'DZD', baseAmount: '100.00',
  shocks: [{ bucket: 'SHORT_TERM', basisPoints: -100 }] as const,
  engineVersion: 'risk-2.1', inputChecksumSha256: 'a'.repeat(64), actorId: ' risk-analyst ',
};

describe('RunStressScenario', () => {
  it('rejects impossible dates and excessive decimal precision before persistence', async () => {
    const repository = { runAtomically: vi.fn() } as unknown as StressScenarioRepository;
    const service = new RunStressScenario(repository);

    expect(() => service.execute({ ...validCommand, businessDate: '2026-02-30' })).toThrow('valid YYYY-MM-DD');
    expect(() => service.execute({ ...validCommand, baseAmount: '1.1234567890123' })).toThrow('at most 12 decimals');
    expect(repository.runAtomically).not.toHaveBeenCalled();
  });

  it('normalizes the actor before delegating to the atomic repository', async () => {
    const runAtomically = vi.fn<StressScenarioRepository['runAtomically']>(
      async () => ({ stressScenarioId: 'scenario-id', state: 'COMPLETED' as const, results: [] }),
    );
    const service = new RunStressScenario({ runAtomically });

    await service.execute(validCommand);

    expect(runAtomically.mock.calls[0]?.[0]).toMatchObject({ actorId: 'risk-analyst' });
  });
});
