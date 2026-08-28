export type InvestmentAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface InvestmentAccountState {
  accountId: string;
  customerToken: string;
  productCode: string;
  currency: string;
  openedOn: string;
  status: InvestmentAccountStatus;
  closedOn?: string;
}

export class InvestmentAccount {
  private constructor(private state: InvestmentAccountState) {}

  static open(input: Omit<InvestmentAccountState, 'status' | 'closedOn'>): InvestmentAccount {
    validate(input);
    return new InvestmentAccount({ ...input, status: 'ACTIVE' });
  }

  static restore(state: InvestmentAccountState): InvestmentAccount {
    validate(state);
    if (state.status === 'CLOSED' && !state.closedOn) throw new TypeError('Closed account requires closedOn');
    return new InvestmentAccount({ ...state });
  }

  suspend(): void {
    if (this.state.status !== 'ACTIVE') throw new Error(`Cannot suspend account from ${this.state.status}`);
    this.state = { ...this.state, status: 'SUSPENDED' };
  }

  reactivate(): void {
    if (this.state.status !== 'SUSPENDED') throw new Error(`Cannot reactivate account from ${this.state.status}`);
    this.state = { ...this.state, status: 'ACTIVE' };
  }

  close(businessDate: string): void {
    assertDate(businessDate);
    if (this.state.status === 'CLOSED') throw new Error('Account is already closed');
    if (businessDate < this.state.openedOn) throw new Error('Account cannot close before opening');
    this.state = { ...this.state, status: 'CLOSED', closedOn: businessDate };
  }

  snapshot(): Readonly<InvestmentAccountState> {
    return Object.freeze({ ...this.state });
  }
}

function validate(input: Pick<InvestmentAccountState, 'accountId' | 'customerToken' | 'productCode' | 'currency' | 'openedOn'>): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.accountId)) {
    throw new TypeError('Investment account identifier must be a UUID');
  }
  if (!/^tok_[A-Za-z0-9_-]{16,}$/.test(input.customerToken)) throw new TypeError('Customer identifier must be tokenized');
  if (!/^[A-Z0-9_-]{2,32}$/.test(input.productCode)) throw new TypeError('Invalid investment product code');
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new TypeError('Invalid investment account currency');
  assertDate(input.openedOn);
}

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new TypeError('Invalid business date');
  }
}
