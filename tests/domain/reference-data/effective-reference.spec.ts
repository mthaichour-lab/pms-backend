import { describe, expect, it } from 'vitest';

import {
  assertCurrencyCode,
  resolveEffectiveVersion,
} from '../../../src/modules/reference-data/domain/effective-reference.js';

describe('effective reference data', () => {
  const versions = [
    { validFrom: '2020-01-01', validUntil: '2025-01-01', value: 'old' },
    { validFrom: '2025-01-01', value: 'current' },
  ];

  it('uses half-open effective periods at the business-date boundary', () => {
    expect(resolveEffectiveVersion(versions, '2024-12-31')?.value).toBe('old');
    expect(resolveEffectiveVersion(versions, '2025-01-01')?.value).toBe('current');
  });

  it('fails closed when versions overlap', () => {
    expect(() => resolveEffectiveVersion([
      { validFrom: '2025-01-01', value: 1 },
      { validFrom: '2025-02-01', value: 2 },
    ], '2025-03-01')).toThrow('Overlapping');
  });

  it('requires uppercase ISO currency codes', () => {
    expect(() => assertCurrencyCode('DZD')).not.toThrow();
    expect(() => assertCurrencyCode('dzd')).toThrow('ISO 4217');
  });
});
