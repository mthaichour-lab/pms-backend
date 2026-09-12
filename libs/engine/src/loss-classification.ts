export type LossCause =
  | 'ORDINARY_MARKET_LOSS'
  | 'CREDIT_LOSS'
  | 'EXTERNAL_OPERATIONAL_EVENT'
  | 'MANAGER_FAULT_OR_NEGLIGENCE'
  | 'MANDATE_VIOLATION'
  | 'SHARIA_NON_COMPLIANCE';

export type IrrAbsorptionPolicy = 'APPROVED' | 'NOT_APPROVED' | 'NOT_APPLICABLE';

export interface LossAbsorptionInput {
  lossAmount: string;
  cause: LossCause;
  irrPolicy: IrrAbsorptionPolicy;
  availableIrr: string;
  availablePer: string;
  availableDepositorCapital: string;
  currencyScale?: number;
}

export interface LossAbsorptionResult {
  cause: LossCause;
  liability: 'BANK' | 'INVESTORS';
  irrAbsorption: string;
  perAbsorption: string;
  depositorCapitalAbsorption: string;
  bankAbsorption: string;
  unabsorbedLoss: string;
  conservationDifference: string;
  appliedCascade: readonly string[];
}

const BANK_LIABILITY_CAUSES = new Set<LossCause>([
  'MANAGER_FAULT_OR_NEGLIGENCE',
  'MANDATE_VIOLATION',
  'SHARIA_NON_COMPLIANCE',
]);

export function isBankLiabilityCause(cause: LossCause): boolean {
  return BANK_LIABILITY_CAUSES.has(cause);
}

export function classifyLossAbsorption(input: LossAbsorptionInput): LossAbsorptionResult {
  const scale = input.currencyScale ?? 2;
  if (!Number.isInteger(scale) || scale < 0 || scale > 12) throw new RangeError('currencyScale must be an integer between 0 and 12');
  const loss = units(input.lossAmount, scale, 'lossAmount');
  if (loss <= 0n) throw new RangeError('lossAmount must be positive');
  const availableIrr = units(input.availableIrr, scale, 'availableIrr');
  const availablePer = units(input.availablePer, scale, 'availablePer');
  const availableCapital = units(input.availableDepositorCapital, scale, 'availableDepositorCapital');

  if (isBankLiabilityCause(input.cause)) {
    return result(input.cause, loss, 0n, 0n, 0n, loss, 0n, scale, ['BANK_CAUSAL_LIABILITY']);
  }

  let remaining = loss;
  const irr = input.irrPolicy === 'APPROVED' ? take(availableIrr, remaining) : 0n;
  remaining -= irr;
  const per = take(availablePer, remaining);
  remaining -= per;
  const depositorCapital = take(availableCapital, remaining);
  remaining -= depositorCapital;
  return result(
    input.cause,
    loss,
    irr,
    per,
    depositorCapital,
    0n,
    remaining,
    scale,
    [...(irr > 0n ? ['IRR'] : []), ...(per > 0n ? ['PER'] : []), ...(depositorCapital > 0n ? ['DEPOSITOR_CAPITAL'] : [])],
  );
}

function result(
  cause: LossCause,
  loss: bigint,
  irr: bigint,
  per: bigint,
  capital: bigint,
  bank: bigint,
  unabsorbed: bigint,
  scale: number,
  cascade: readonly string[],
): LossAbsorptionResult {
  const difference = loss - irr - per - capital - bank - unabsorbed;
  if (difference !== 0n) throw new Error('Loss conservation invariant violated');
  return {
    cause,
    liability: isBankLiabilityCause(cause) ? 'BANK' : 'INVESTORS',
    irrAbsorption: decimal(irr, scale),
    perAbsorption: decimal(per, scale),
    depositorCapitalAbsorption: decimal(capital, scale),
    bankAbsorption: decimal(bank, scale),
    unabsorbedLoss: decimal(unabsorbed, scale),
    conservationDifference: decimal(difference, scale),
    appliedCascade: cascade,
  };
}

function take(available: bigint, required: bigint): bigint {
  return available < required ? available : required;
}

function units(value: string, scale: number, field: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new TypeError(`${field} must be a canonical non-negative decimal string`);
  const fraction = match[2] ?? '';
  if (fraction.length > scale) throw new RangeError(`${field} exceeds currency scale ${scale}`);
  return BigInt(`${match[1]}${fraction.padEnd(scale, '0')}`);
}

function decimal(value: bigint, scale: number): string {
  const digits = value.toString().padStart(scale + 1, '0');
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
