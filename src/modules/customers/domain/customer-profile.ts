export type CustomerSegment = 'RETAIL' | 'SME' | 'CORPORATE' | 'INSTITUTIONAL';
export type KycStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REJECTED';
export type LegalRestrictionKind = 'SEIZURE' | 'OPPOSITION' | 'BLOCK';
export interface LegalRestriction { restrictionId: string; kind: LegalRestrictionKind; reason: string; effectiveFrom: string; liftedAt?: string; }
export interface CustomerProfileState { customerId: string; identityToken: string; beneficialOwnerTokens: readonly string[]; representativeTokens: readonly string[]; segment: CustomerSegment; kycStatus: KycStatus; legalForm: string; sectorCode: string; branchCode: string; restrictions: readonly LegalRestriction[]; }

export class CustomerProfile {
  private constructor(private state: CustomerProfileState) {}
  static create(state: CustomerProfileState): CustomerProfile { validate(state); return new CustomerProfile(copy(state)); }
  static restore(state: CustomerProfileState): CustomerProfile { return CustomerProfile.create(state); }
  addRestriction(restriction: LegalRestriction): void { validateRestriction(restriction); if (this.state.restrictions.some(item => item.restrictionId === restriction.restrictionId)) throw new Error('Customer restriction already exists'); this.state = { ...this.state, restrictions: [...this.state.restrictions, { ...restriction }] }; }
  liftRestriction(restrictionId: string, liftedAt: string): void { assertDate(liftedAt); const current = this.state.restrictions.find(item => item.restrictionId === restrictionId); if (!current) throw new Error('Customer restriction not found'); if (current.liftedAt) throw new Error('Customer restriction is already lifted'); if (liftedAt < current.effectiveFrom) throw new Error('Restriction cannot be lifted before its effective date'); this.state = { ...this.state, restrictions: this.state.restrictions.map(item => item.restrictionId === restrictionId ? { ...item, liftedAt } : item) }; }
  assertProfitRightsOperationAllowed(): void { const active = this.state.restrictions.find(item => !item.liftedAt); if (active) throw new Error(`Customer profit rights blocked by active ${active.kind} restriction`); }
  snapshot(): Readonly<CustomerProfileState> { return Object.freeze(copy(this.state)); }
}
function validate(state: CustomerProfileState) { if (!uuid(state.customerId)) throw new TypeError('Customer identifier must be a UUID'); [state.identityToken, ...state.beneficialOwnerTokens, ...state.representativeTokens].forEach(assertToken); if (!state.legalForm.trim() || !state.sectorCode.trim() || !state.branchCode.trim()) throw new TypeError('Customer classification is incomplete'); state.restrictions.forEach(validateRestriction); }
function validateRestriction(value: LegalRestriction) { if (!uuid(value.restrictionId)) throw new TypeError('Restriction identifier must be a UUID'); if (!value.reason.trim()) throw new TypeError('Restriction reason is required'); assertDate(value.effectiveFrom); if (value.liftedAt) assertDate(value.liftedAt); }
function assertToken(value: string) { if (!/^tok_[A-Za-z0-9_-]{16,128}$/.test(value)) throw new TypeError('Customer personal data must be tokenized'); }
function uuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}function assertDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(`${value}T00:00:00Z`)))throw new TypeError('Invalid business date')}function copy(state:CustomerProfileState):CustomerProfileState{return{...state,beneficialOwnerTokens:[...state.beneficialOwnerTokens],representativeTokens:[...state.representativeTokens],restrictions:state.restrictions.map(item=>({...item}))}}
