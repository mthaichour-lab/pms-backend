import { assertBusinessDate, assertCurrencyCode } from '../domain/effective-reference.js';

export interface CurrencyDefinition {
  code: string;
  name: string;
  fractionDigits: number;
  validFrom: string;
  validUntil?: string;
}

export interface CurrencyReferenceRepository {
  findEffective(code: string, businessDate: string): Promise<CurrencyDefinition | undefined>;
}

export class GetEffectiveCurrency {
  constructor(private readonly repository: CurrencyReferenceRepository) {}

  async execute(code: string, businessDate: string): Promise<CurrencyDefinition> {
    assertCurrencyCode(code);
    assertBusinessDate(businessDate);
    const currency = await this.repository.findEffective(code, businessDate);
    if (!currency) throw new Error(`No effective currency ${code} at ${businessDate}`);
    return currency;
  }
}
