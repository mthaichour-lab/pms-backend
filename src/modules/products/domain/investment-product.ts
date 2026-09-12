export type InvestmentProductStatus = 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'SUSPENDED' | 'CLOSED';

export interface InvestmentProductState {
  productId: string;
  code: string;
  name: string;
  investorNisba: string;
  bankNisba: string;
  shariaReference?: string;
  validatedBy?: string;
  status: InvestmentProductStatus;
}

export interface ProductTransition {
  fromStatus: InvestmentProductStatus;
  toStatus: InvestmentProductStatus;
  actorId: string;
  justification: string;
}

export class InvestmentProduct {
  private pendingTransition?: ProductTransition;

  private constructor(private state: InvestmentProductState) {}

  static draft(input: Omit<InvestmentProductState, 'status'>): InvestmentProduct {
    validateState(input);
    return new InvestmentProduct({ ...input, status: 'DRAFT' });
  }

  static restore(state: InvestmentProductState): InvestmentProduct {
    validateState(state);
    return new InvestmentProduct({ ...state });
  }

  validate(actorId: string, justification: string): void {
    this.transition('VALIDATED', actorId, justification, ['DRAFT']);
    this.state = { ...this.state, validatedBy: actorId.trim() };
  }

  publish(actorId: string, justification: string): void {
    if (toMillionths(this.state.investorNisba) + toMillionths(this.state.bankNisba) !== 100_000_000n) {
      throw new Error('Investor and bank Nisba must total 100%');
    }
    if (!this.state.shariaReference?.trim()) throw new Error('Sharia reference is required for publication');
    if (this.state.validatedBy === actorId.trim()) throw new Error('Product publication requires an independent checker');
    this.transition('PUBLISHED', actorId, justification, ['VALIDATED']);
  }

  suspend(actorId: string, justification: string): void { this.transition('SUSPENDED', actorId, justification, ['PUBLISHED']); }
  resume(actorId: string, justification: string): void { this.transition('PUBLISHED', actorId, justification, ['SUSPENDED']); }
  close(actorId: string, justification: string): void { this.transition('CLOSED', actorId, justification, ['PUBLISHED', 'SUSPENDED']); }

  snapshot(): Readonly<InvestmentProductState> { return Object.freeze({ ...this.state }); }
  pullTransition(): ProductTransition | undefined {
    const transition = this.pendingTransition;
    this.pendingTransition = undefined;
    return transition ? Object.freeze({ ...transition }) : undefined;
  }

  private transition(toStatus: InvestmentProductStatus, actorId: string, justification: string, allowed: InvestmentProductStatus[]): void {
    if (!allowed.includes(this.state.status)) throw new Error(`Cannot transition product from ${this.state.status} to ${toStatus}`);
    if (!actorId.trim()) throw new TypeError('Transition actor is required');
    if (justification.trim().length < 10) throw new TypeError('Transition justification must contain at least 10 characters');
    const fromStatus = this.state.status;
    this.state = { ...this.state, status: toStatus };
    this.pendingTransition = { fromStatus, toStatus, actorId: actorId.trim(), justification: justification.trim() };
  }
}

function validateState(input: Omit<InvestmentProductState, 'status'> | InvestmentProductState): void {
  if (!isUuid(input.productId)) throw new TypeError('Product identifier must be a UUID');
  if (!/^[A-Z0-9_-]{2,32}$/.test(input.code)) throw new TypeError('Invalid product code');
  if (input.name.trim().length < 3) throw new TypeError('Product name must contain at least 3 characters');
  toMillionths(input.investorNisba);
  toMillionths(input.bankNisba);
  if ('status' in input && input.status !== 'DRAFT') {
    if (!input.validatedBy?.trim()) throw new Error('Validated product requires a validator identity');
    if (toMillionths(input.investorNisba) + toMillionths(input.bankNisba) !== 100_000_000n) throw new Error('Investor and bank Nisba must total 100%');
    if (!input.shariaReference?.trim()) throw new Error('Sharia reference is required for publication');
  }
}

function toMillionths(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,6})?$/.test(value)) throw new TypeError('Nisba must be a decimal percentage');
  const [whole, fraction = ''] = value.split('.');
  const scaled = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  if (scaled > 100_000_000n) throw new RangeError('Nisba must be between 0 and 100');
  return scaled;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
