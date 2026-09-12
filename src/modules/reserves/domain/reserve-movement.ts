import { Money } from '../../../shared-kernel/money.js';

export type ReserveType = 'PER' | 'IRR';
export type ReserveMovementKind = 'FUND' | 'RELEASE' | 'UTILIZE' | 'ADJUST';

export interface ReserveMovement {
  reserveType: ReserveType;
  kind: ReserveMovementKind;
  openingBalance: string;
  movementAmount: string;
  closingBalance: string;
  currency: string;
  scale: number;
}

export interface GovernedReserveMovementInput extends Omit<ReserveMovement, 'closingBalance'> {
  poolId: string;
  investorOpeningBalance: string;
  bankOpeningBalance: string;
  investorMovementAmount: string;
  bankMovementAmount: string;
  minimumBalance: string;
  maximumBalance: string;
  approvalThreshold: string;
  approvalId?: string;
}

export interface GovernedReserveMovement extends ReserveMovement {
  poolId: string;
  investorClosingBalance: string;
  bankClosingBalance: string;
  approvalRequired: boolean;
  approvalId?: string;
}

export function calculateReserveMovement(input: Omit<ReserveMovement, 'closingBalance'>): ReserveMovement {
  const opening = Money.parse(input.openingBalance, input.currency, input.scale);
  const movement = Money.parse(input.movementAmount, input.currency, input.scale);
  const closing = opening.add(movement);
  if (closing.compare(Money.parse('0', input.currency, input.scale)) < 0) {
    throw new RangeError(`${input.reserveType} reserve cannot become negative`);
  }
  if (input.kind === 'FUND' && movement.compare(Money.parse('0', input.currency, input.scale)) < 0) {
    throw new RangeError('Reserve funding must be positive');
  }
  if ((input.kind === 'RELEASE' || input.kind === 'UTILIZE') &&
    movement.compare(Money.parse('0', input.currency, input.scale)) > 0) {
    throw new RangeError('Reserve release or utilization must be negative');
  }
  return { ...input, closingBalance: closing.toDecimalString() };
}

export function authorizeReserveMovement(input: GovernedReserveMovementInput): GovernedReserveMovement {
  if (!input.poolId.trim()) throw new TypeError('poolId is required');
  const base = calculateReserveMovement(input);
  const opening = Money.parse(input.openingBalance, input.currency, input.scale);
  const movement = Money.parse(input.movementAmount, input.currency, input.scale);
  const investorOpening = Money.parse(input.investorOpeningBalance, input.currency, input.scale);
  const bankOpening = Money.parse(input.bankOpeningBalance, input.currency, input.scale);
  const investorMovement = Money.parse(input.investorMovementAmount, input.currency, input.scale);
  const bankMovement = Money.parse(input.bankMovementAmount, input.currency, input.scale);
  if (investorOpening.add(bankOpening).compare(opening) !== 0) {
    throw new RangeError('Investor and bank opening shares must equal the reserve opening balance');
  }
  if (investorMovement.add(bankMovement).compare(movement) !== 0) {
    throw new RangeError('Investor and bank movement shares must equal the reserve movement');
  }
  const investorClosing = investorOpening.add(investorMovement);
  const bankClosing = bankOpening.add(bankMovement);
  const zero = Money.parse('0', input.currency, input.scale);
  if (investorClosing.compare(zero) < 0 || bankClosing.compare(zero) < 0) {
    throw new RangeError('Investor and bank reserve shares cannot become negative');
  }
  const closing = Money.parse(base.closingBalance, input.currency, input.scale);
  const minimum = Money.parse(input.minimumBalance, input.currency, input.scale);
  const maximum = Money.parse(input.maximumBalance, input.currency, input.scale);
  const threshold = Money.parse(input.approvalThreshold, input.currency, input.scale);
  if (minimum.compare(maximum) > 0) throw new RangeError('Reserve minimum cannot exceed maximum');
  const absoluteMovement = Money.fromMinorUnits(
    movement.toMinorUnits() < 0n ? -movement.toMinorUnits() : movement.toMinorUnits(), input.currency, input.scale,
  );
  const approvalRequired = absoluteMovement.compare(threshold) > 0 || closing.compare(minimum) < 0 || closing.compare(maximum) > 0;
  if (approvalRequired && !input.approvalId?.trim()) {
    throw new Error('Reserve movement requires explicit approval before application');
  }
  return {
    reserveType: input.reserveType,
    kind: input.kind,
    openingBalance: input.openingBalance,
    movementAmount: input.movementAmount,
    closingBalance: base.closingBalance,
    currency: input.currency,
    scale: input.scale,
    poolId: input.poolId,
    investorClosingBalance: investorClosing.toDecimalString(),
    bankClosingBalance: bankClosing.toDecimalString(),
    approvalRequired,
    ...(input.approvalId === undefined ? {} : { approvalId: input.approvalId }),
  };
}
