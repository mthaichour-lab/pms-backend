import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('DR failover network bounds', () => {
  it('uses bounded AbortSignal timeouts for every control-plane request', async () => {
    const source = await readFile('deploy/dr/run-failover-drill.mjs', 'utf8');
    expect(source).toContain('AbortSignal.timeout');
    expect(source).toContain('Math.min(10_000');
    expect(source).toContain('deadline - Date.now()');
  });
});
