import { describe, expect, it } from 'vitest';
import { GetEffectiveRegulatoryRule, type ReferenceData } from '../../../src/modules/reference-data/application/regulatory-reference.js';

const rule = { ruleCode: 'BA.REG_20-02', version: 1, authority: 'BANK_OF_ALGERIA' as const, legalReference: 'Règlement 20-02', effectiveFrom: '2020-03-15', parameters: { liquidityRatio: '1.0' } };

describe('GetEffectiveRegulatoryRule', () => {
  it('obtains national rules exclusively through the ReferenceData port', async () => {
    const port: ReferenceData = { findEffectiveRegulatoryRule: async () => rule };
    await expect(new GetEffectiveRegulatoryRule(port).execute('BA.REG_20-02', '2026-08-29')).resolves.toEqual(rule);
  });

  it('rejects impossible business dates and out-of-period adapter results', async () => {
    const port: ReferenceData = { findEffectiveRegulatoryRule: async () => ({ ...rule, effectiveFrom: '2027-01-01' }) };
    await expect(new GetEffectiveRegulatoryRule(port).execute('BA.REG_20-02', '2026-02-30')).rejects.toThrow('Invalid business date');
    await expect(new GetEffectiveRegulatoryRule(port).execute('BA.REG_20-02', '2026-08-29')).rejects.toThrow('outside');
  });
});
