export type RegulatoryAuthority = 'BANK_OF_ALGERIA' | 'SHARIA_COMMITTEE' | 'AAOIFI' | 'IFSB';

export interface RegulatoryRule {
  ruleCode: string;
  version: number;
  authority: RegulatoryAuthority;
  legalReference: string;
  effectiveFrom: string;
  effectiveTo?: string;
  parameters: Readonly<Record<string, string>>;
}

export function assertRegulatoryRule(rule: RegulatoryRule): void {
  if (!/^[A-Z][A-Z0-9_.-]{2,63}$/.test(rule.ruleCode)) throw new TypeError('Invalid regulatory rule code');
  if (!Number.isInteger(rule.version) || rule.version < 1) throw new TypeError('Regulatory rule version must be positive');
  if (rule.legalReference.trim().length < 3) throw new TypeError('Regulatory rule legal reference is required');
  assertDate(rule.effectiveFrom);
  if (rule.effectiveTo) { assertDate(rule.effectiveTo); if (rule.effectiveTo < rule.effectiveFrom) throw new Error('Regulatory rule effective range is invalid'); }
  if (Object.keys(rule.parameters).length === 0) throw new TypeError('Regulatory rule parameters are required');
  for (const [key, value] of Object.entries(rule.parameters)) {
    if (!/^[a-z][A-Za-z0-9]{1,63}$/.test(key) || !value.trim()) throw new TypeError('Invalid regulatory rule parameter');
  }
}

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Invalid regulatory rule date');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new TypeError('Invalid regulatory rule date');
}
