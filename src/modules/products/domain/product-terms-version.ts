export type ProductTermsStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export interface ProductTermsState {
  termsVersionId: string;
  productId: string;
  version: number;
  effectiveFrom: string;
  effectiveTo?: string;
  investorNisba: string;
  bankNisba: string;
  indicativeTargetRate?: string;
  status: ProductTermsStatus;
  simulationChecksumSha256?: string;
  retroactiveApprovalId?: string;
  createdBy: string;
}

export class ProductTermsVersion {
  private constructor(private state: ProductTermsState) {}

  static draft(input: Omit<ProductTermsState, 'status' | 'simulationChecksumSha256' | 'retroactiveApprovalId'>): ProductTermsVersion {
    validate(input);
    return new ProductTermsVersion({ ...input, status: 'DRAFT' });
  }

  static restore(state: ProductTermsState): ProductTermsVersion { validate(state); return new ProductTermsVersion({ ...state }); }

  publish(input: { businessDate: string; simulationChecksumSha256: string; retroactiveApprovalId?: string; actorId: string }): void {
    if (this.state.status !== 'DRAFT') throw new Error(`Cannot publish product terms from ${this.state.status}`);
    assertDate(input.businessDate);
    if (!/^[0-9a-f]{64}$/.test(input.simulationChecksumSha256)) throw new TypeError('A valid simulation checksum is required');
    if (!input.actorId.trim() || input.actorId.trim() === this.state.createdBy) throw new Error('Product terms require an independent checker');
    if (this.state.effectiveFrom < input.businessDate && !/^[A-Za-z0-9._:-]{16,128}$/.test(input.retroactiveApprovalId ?? '')) {
      throw new Error('Retroactive product terms require a double approval');
    }
    this.state = { ...this.state, status: 'PUBLISHED', simulationChecksumSha256: input.simulationChecksumSha256, retroactiveApprovalId: input.retroactiveApprovalId };
  }

  retire(): void {
    if (this.state.status !== 'PUBLISHED') throw new Error(`Cannot retire product terms from ${this.state.status}`);
    this.state = { ...this.state, status: 'RETIRED' };
  }

  snapshot(): Readonly<ProductTermsState> { return Object.freeze({ ...this.state }); }
}

function validate(input: Omit<ProductTermsState, 'status' | 'simulationChecksumSha256' | 'retroactiveApprovalId'> | ProductTermsState): void {
  if (!isUuid(input.termsVersionId) || !isUuid(input.productId)) throw new TypeError('Product terms identifiers must be UUIDs');
  if (!input.createdBy.trim()) throw new TypeError('Product terms creator is required');
  if (!Number.isInteger(input.version) || input.version < 1) throw new TypeError('Product terms version must be a positive integer');
  assertDate(input.effectiveFrom);
  if (input.effectiveTo) { assertDate(input.effectiveTo); if (input.effectiveTo < input.effectiveFrom) throw new Error('Terms end date cannot precede start date'); }
  if (percentage(input.investorNisba) + percentage(input.bankNisba) !== 100_000_000n) throw new Error('Investor and bank Nisba must total 100%');
  if (input.indicativeTargetRate !== undefined) percentage(input.indicativeTargetRate);
  if ('status' in input && input.status !== 'DRAFT' && !/^[0-9a-f]{64}$/.test(input.simulationChecksumSha256 ?? '')) {
    throw new TypeError('Published product terms require a valid simulation checksum');
  }
}

function percentage(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,6})?$/.test(value)) throw new TypeError('Percentage must be a decimal between 0 and 100');
  const [whole, fraction = ''] = value.split('.'); const result = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  if (result > 100_000_000n) throw new RangeError('Percentage must be a decimal between 0 and 100'); return result;
}
function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Invalid effective date');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new TypeError('Invalid effective date');
}
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
