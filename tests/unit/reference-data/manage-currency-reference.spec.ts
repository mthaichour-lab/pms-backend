import { describe, expect, it, vi } from 'vitest';

import { ManageCurrencyReference } from '../../../src/modules/reference-data/application/currency-reference.js';

const draft = { code: 'EUR', name: 'Euro', fractionDigits: 2, validFrom: '2026-01-01' };

describe('ManageCurrencyReference', () => {
  it('stores a normalized immutable currency version and pages current references', async () => {
    const saveVersion = vi.fn(async (value) => value);
    const listEffective = vi.fn(async () => ({ items: [draft], total: 1 }));
    const service = new ManageCurrencyReference({ findEffective: vi.fn(), saveVersion, listEffective });

    await expect(service.create({ ...draft, name: '  Euro  ' }, 'admin-1')).resolves.toEqual(draft);
    await expect(service.list('2026-02-01', 25, 0)).resolves.toEqual({ items: [draft], total: 1 });
    expect(saveVersion).toHaveBeenCalledWith(draft, 'admin-1');
    expect(listEffective).toHaveBeenCalledWith('2026-02-01', 25, 0);
  });

  it('rejects invalid code, scale, period and pagination before persistence', async () => {
    const saveVersion = vi.fn();
    const service = new ManageCurrencyReference({ findEffective: vi.fn(), saveVersion, listEffective: vi.fn() });

    await expect(service.create({ ...draft, code: 'eur' }, 'admin-1')).rejects.toThrow('ISO 4217');
    await expect(service.create({ ...draft, fractionDigits: 7 }, 'admin-1')).rejects.toThrow('fraction digits');
    await expect(service.create({ ...draft, validUntil: '2026-01-01' }, 'admin-1')).rejects.toThrow('validUntil');
    await expect(service.list('2026-02-01', 101, 0)).rejects.toThrow('limit');
    expect(saveVersion).not.toHaveBeenCalled();
  });
});
