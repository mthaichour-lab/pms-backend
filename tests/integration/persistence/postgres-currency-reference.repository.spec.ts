import { describe, expect, it, vi } from 'vitest';

import { PostgresCurrencyReferenceRepository } from '../../../src/infrastructure/persistence/postgres-currency-reference.repository.js';

describe('PostgresCurrencyReferenceRepository', () => {
  it('lists effective versions and persists new versions', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ currency_code: 'DZD', display_name: 'Algerian dinar', fraction_digits: 2, valid_from: '2026-01-01', valid_until: null }] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ currency_code: 'EUR', display_name: 'Euro', fraction_digits: 2, valid_from: '2026-01-01', valid_until: null }] });
    const repository = new PostgresCurrencyReferenceRepository({ query } as never);

    await expect(repository.listEffective('2026-02-01', 25, 0)).resolves.toEqual({ items: [{ code: 'DZD', name: 'Algerian dinar', fractionDigits: 2, validFrom: '2026-01-01' }], total: 1 });
    await expect(repository.saveVersion({ code: 'EUR', name: 'Euro', fractionDigits: 2, validFrom: '2026-01-01' }, 'admin-1')).resolves.toEqual({ code: 'EUR', name: 'Euro', fractionDigits: 2, validFrom: '2026-01-01' });
    expect(query.mock.calls[2]?.[0]).toContain('close_preceding_version');
    expect(query.mock.calls[2]?.[1]).toEqual(['EUR', 'Euro', 2, '2026-01-01', null, 'admin-1']);
  });

  it('returns an idempotent replay but rejects a conflicting same-date version', async () => {
    const replay = { currency_code: 'EUR', display_name: 'Euro', fraction_digits: 2, valid_from: '2026-01-01', valid_until: null };
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [replay] });
    const repository = new PostgresCurrencyReferenceRepository({ query } as never);
    await expect(repository.saveVersion({ code: 'EUR', name: 'Euro', fractionDigits: 2, validFrom: '2026-01-01' }, 'admin-1')).resolves.toEqual({ code: 'EUR', name: 'Euro', fractionDigits: 2, validFrom: '2026-01-01' });
    query.mockReset().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ ...replay, display_name: 'Different Euro' }] });
    await expect(repository.saveVersion({ code: 'EUR', name: 'Euro', fractionDigits: 2, validFrom: '2026-01-01' }, 'admin-1')).rejects.toThrow('different content');
  });
});
