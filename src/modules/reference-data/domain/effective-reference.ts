export interface EffectiveVersion<T> {
  validFrom: string;
  validUntil?: string;
  value: T;
}

export function resolveEffectiveVersion<T>(
  versions: readonly EffectiveVersion<T>[],
  businessDate: string,
): EffectiveVersion<T> | undefined {
  assertIsoDate(businessDate, 'business date');
  const matches = versions.filter((version) => {
    assertIsoDate(version.validFrom, 'validFrom');
    if (version.validUntil) assertIsoDate(version.validUntil, 'validUntil');
    return version.validFrom <= businessDate && (!version.validUntil || businessDate < version.validUntil);
  });
  if (matches.length > 1) throw new Error(`Overlapping reference versions for ${businessDate}`);
  return matches[0];
}

export function assertCurrencyCode(code: string): void {
  if (!/^[A-Z]{3}$/.test(code)) throw new TypeError('Currency code must be ISO 4217 uppercase');
}

export function assertBusinessDate(value: string): void {
  assertIsoDate(value, 'business date');
}

function assertIsoDate(value: string, name: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new TypeError(`${name} must be an ISO business date`);
  }
}
