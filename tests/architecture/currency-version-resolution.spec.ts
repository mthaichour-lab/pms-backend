import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const repositoryFiles = [
  'src/infrastructure/persistence/postgres-dcr.repository.ts',
  'src/infrastructure/persistence/postgres-stress-scenario.repository.ts',
  'src/infrastructure/persistence/postgres-accounting-reversal.repository.ts',
] as const;

describe('business-date currency resolution', () => {
  it.each(repositoryFiles)('%s resolves versioned monetary precision', async (filename) => {
    const source = await readFile(filename, 'utf8');
    expect(source).toContain('reference.currency_version');
    expect(source).toContain('fraction_digits');
    expect(source).toMatch(/valid_from\s*<=/);
    expect(source).toMatch(/valid_until\s+IS\s+NULL/);
    expect(source).not.toMatch(/reference\.currency\s+(?:c\s+)?(?:WHERE|JOIN)/);
  });
});
