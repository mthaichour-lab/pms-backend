import { assertRegulatoryRule, type RegulatoryRule } from '../domain/regulatory-rule.js';

export interface ReferenceData {
  findEffectiveRegulatoryRule(ruleCode: string, businessDate: string): Promise<RegulatoryRule | undefined>;
}

export class GetEffectiveRegulatoryRule {
  constructor(private readonly referenceData: ReferenceData) {}

  async execute(ruleCode: string, businessDate: string): Promise<RegulatoryRule> {
    if (!/^[A-Z][A-Z0-9_.-]{2,63}$/.test(ruleCode)) throw new TypeError('Invalid regulatory rule code');
    assertBusinessDate(businessDate);
    const rule = await this.referenceData.findEffectiveRegulatoryRule(ruleCode, businessDate);
    if (!rule) throw new Error(`Regulatory rule not found: ${ruleCode}`);
    assertRegulatoryRule(rule);
    if (rule.effectiveFrom > businessDate || (rule.effectiveTo && rule.effectiveTo < businessDate)) {
      throw new Error('ReferenceData returned a rule outside its effective period');
    }
    return rule;
  }
}

function assertBusinessDate(value: string): void {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError('Invalid business date');
  }
}
