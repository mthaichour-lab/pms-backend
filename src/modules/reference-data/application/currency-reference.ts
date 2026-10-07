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

export interface CurrencyReferencePage {
  items: readonly CurrencyDefinition[];
  total: number;
}

/**
 * Administration is intentionally separate from read resolution: consumers of
 * a reference need only the effective version, while administrators are the
 * only callers that can introduce a new immutable version.
 */
export interface CurrencyAdministrationRepository extends CurrencyReferenceRepository {
  listEffective(businessDate: string, limit: number, offset: number): Promise<CurrencyReferencePage>;
  saveVersion(currency: CurrencyDefinition, actorId: string): Promise<CurrencyDefinition>;
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

export class ManageCurrencyReference {
  constructor(private readonly repository: CurrencyAdministrationRepository) {}

  async list(businessDate: string, limit = 50, offset = 0): Promise<CurrencyReferencePage> {
    assertBusinessDate(businessDate);
    assertPagination(limit, 'limit');
    assertPagination(offset, 'offset');
    return this.repository.listEffective(businessDate, limit, offset);
  }

  async create(input: CurrencyDefinition, actorId: string): Promise<CurrencyDefinition> {
    validateDefinition(input);
    if (!actorId.trim()) throw new TypeError('Currency reference actor is required');
    return this.repository.saveVersion(normalizeDefinition(input), actorId);
  }
}

function validateDefinition(value: CurrencyDefinition): void {
  assertCurrencyCode(value.code);
  if (!value.name.trim() || value.name.trim().length > 120) {
    throw new TypeError('Currency name must contain between 1 and 120 characters');
  }
  if (!Number.isInteger(value.fractionDigits) || value.fractionDigits < 0 || value.fractionDigits > 6) {
    throw new TypeError('Currency fraction digits must be an integer between 0 and 6');
  }
  assertBusinessDate(value.validFrom);
  if (value.validUntil !== undefined) {
    assertBusinessDate(value.validUntil);
    if (value.validUntil <= value.validFrom) {
      throw new TypeError('Currency validUntil must be after validFrom');
    }
  }
}

function normalizeDefinition(value: CurrencyDefinition): CurrencyDefinition {
  return {
    code: value.code.trim().toUpperCase(),
    name: value.name.trim(),
    fractionDigits: value.fractionDigits,
    validFrom: value.validFrom,
    ...(value.validUntil ? { validUntil: value.validUntil } : {}),
  };
}

function assertPagination(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || (field === 'limit' && (value < 1 || value > 100))) {
    throw new TypeError(`${field} must be ${field === 'limit' ? 'an integer between 1 and 100' : 'a non-negative integer'}`);
  }
}
