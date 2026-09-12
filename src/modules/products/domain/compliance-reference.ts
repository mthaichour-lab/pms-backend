export type ComplianceSource = 'BA' | 'SHARIA_COMMITTEE' | 'AAOIFI' | 'IFSB';
export type ProductReferenceKind = 'CONTRACTUAL_DOCUMENT' | 'REGULATORY_DOCUMENT' | 'SHARIA_DOCUMENT' | 'ACCOUNTING_SCHEMA';

export interface ComplianceReferenceState {
  referenceId: string; source: ComplianceSource; referenceCode: string; version: string; title: string;
  effectiveFrom: string; effectiveTo?: string; createdBy: string;
}

export const requiredProductReferenceKinds: readonly ProductReferenceKind[] =
  ['CONTRACTUAL_DOCUMENT', 'REGULATORY_DOCUMENT', 'SHARIA_DOCUMENT', 'ACCOUNTING_SCHEMA'];

export class ComplianceReference {
  private constructor(private readonly state: ComplianceReferenceState) {}
  static create(state: ComplianceReferenceState): ComplianceReference {
    if (!isUuid(state.referenceId)) throw new TypeError('Compliance reference identifier must be a UUID');
    if (!['BA', 'SHARIA_COMMITTEE', 'AAOIFI', 'IFSB'].includes(state.source)) throw new TypeError('Unknown compliance source');
    if (!/^[A-Za-z0-9._/-]{2,80}$/.test(state.referenceCode)) throw new TypeError('Invalid compliance reference code');
    if (!state.version.trim() || state.title.trim().length < 3) throw new TypeError('Compliance reference version and title are required');
    const from = date(state.effectiveFrom, 'effectiveFrom');
    if (state.effectiveTo && date(state.effectiveTo, 'effectiveTo') < from) throw new RangeError('Compliance reference validity period is invalid');
    if (!state.createdBy.trim()) throw new TypeError('Compliance reference creator is required');
    return new ComplianceReference({ ...state });
  }
  snapshot(): Readonly<ComplianceReferenceState> { return Object.freeze({ ...this.state }); }
  isEffectiveOn(businessDate: string): boolean {
    const at = date(businessDate, 'businessDate');
    return date(this.state.effectiveFrom, 'effectiveFrom') <= at && (!this.state.effectiveTo || at <= date(this.state.effectiveTo, 'effectiveTo'));
  }
}

export function compliancePriority(source: ComplianceSource): number {
  return ({ BA: 4, SHARIA_COMMITTEE: 3, AAOIFI: 2, IFSB: 1 })[source];
}
function date(value: string, field: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${field} must use YYYY-MM-DD`);
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new TypeError(`${field} is invalid`);
  return parsed;
}
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
