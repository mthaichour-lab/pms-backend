import { describe, expect, it, vi } from 'vitest';

import { OutboxScheduler } from '../../../apps/scheduler/src/outbox-scheduler.js';
import type { OutboxRelay } from '../../../src/infrastructure/messaging/outbox-relay.js';

describe('OutboxScheduler', () => {
  it('skips overlapping relay executions', async () => {
    let finish: (() => void) | undefined;
    const runBatch = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ published: [], failed: [] });
      }),
    );
    const scheduler = new OutboxScheduler(
      { runBatch } as unknown as OutboxRelay,
      1000,
      10,
      () => '2026-08-28T00:00:00.000Z',
    );

    const first = scheduler.runOnce();
    await expect(scheduler.runOnce()).resolves.toBe('SKIPPED');
    finish?.();
    await expect(first).resolves.toBe('EXECUTED');
    expect(runBatch).toHaveBeenCalledOnce();
  });
});
