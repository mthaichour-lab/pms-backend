import { describe, expect, it, vi } from 'vitest';

import { ClosingGovernanceScheduler } from '../../../apps/scheduler/src/closing-governance-scheduler.js';
import type { ProcessClosingGovernance } from '../../../src/modules/closing-workflow/application/process-closing-governance.js';

describe('ClosingGovernanceScheduler', () => {
  it('prevents overlapping escalation batches', async () => {
    let finish: (() => void) | undefined;
    const execute = vi.fn().mockReturnValue(new Promise((resolve) => {
      finish = () => resolve({ escalated: 2 });
    }));
    const scheduler = new ClosingGovernanceScheduler(
      { execute } as unknown as ProcessClosingGovernance,
      60_000,
      () => '2026-08-30T10:00:00.000Z',
    );

    const first = scheduler.runOnce();
    await expect(scheduler.runOnce()).resolves.toBe('SKIPPED');
    finish?.();
    await expect(first).resolves.toBe('EXECUTED');
    expect(execute).toHaveBeenCalledExactlyOnceWith('2026-08-30T10:00:00.000Z');
  });
});
