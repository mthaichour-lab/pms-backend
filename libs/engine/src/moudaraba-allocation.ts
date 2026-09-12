import { Decimal } from 'decimal.js';

const ExactDecimal = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_DOWN });

export type MoudarabaAllocationMethod = 'FIXED_CATEGORY_KEY' | 'WEIGHTED_AVERAGE';

export interface MoudarabaParticipant {
  accountId: string;
  categoryId: string;
  weightedParticipationBase: string;
}

export interface MoudarabaCategoryKey {
  categoryId: string;
  allocationKey: string;
}

export interface MoudarabaAllocationInput {
  profitAfterPer: string;
  investorNisba: string;
  bankNisba: string;
  irrAllocation: string;
  method: MoudarabaAllocationMethod;
  participants: readonly MoudarabaParticipant[];
  categoryKeys?: readonly MoudarabaCategoryKey[];
  currencyScale?: number;
}

export interface MoudarabaAccountAllocation {
  accountId: string;
  categoryId: string;
  weightedParticipationBase: string;
  allocatedProfit: string;
}

export interface MoudarabaAllocationResult {
  method: MoudarabaAllocationMethod;
  profitAfterPer: string;
  bankShare: string;
  investorShareBeforeIrr: string;
  irrAllocation: string;
  investorShareAfterIrr: string;
  accountAllocations: readonly MoudarabaAccountAllocation[];
  unallocatedRemainder: string;
}

export function allocateMoudarabaProfit(input: MoudarabaAllocationInput): MoudarabaAllocationResult {
  const scale = input.currencyScale ?? 2;
  if (!Number.isInteger(scale) || scale < 0 || scale > 12) {
    throw new RangeError('currencyScale must be an integer between 0 and 12');
  }
  if (input.participants.length === 0) throw new TypeError('At least one participant is required');
  assertUnique(input.participants.map((entry) => entry.accountId), 'accountId');

  const profitUnits = decimalToUnits(input.profitAfterPer, scale, 'profitAfterPer');
  if (profitUnits < 0n) throw new RangeError('profitAfterPer cannot be negative');
  const irrUnits = decimalToUnits(input.irrAllocation, scale, 'irrAllocation');
  if (irrUnits < 0n) throw new RangeError('irrAllocation cannot be negative');
  const investorNisba = nonNegativeDecimal(input.investorNisba, 'investorNisba');
  const bankNisba = nonNegativeDecimal(input.bankNisba, 'bankNisba');
  if (!investorNisba.plus(bankNisba).equals(1)) throw new RangeError('Investor and bank Nisba must total exactly 1');

  const nisbaShares = allocateUnits(profitUnits, [
    { id: 'INVESTOR', weight: investorNisba },
    { id: 'BANK', weight: bankNisba },
  ]);
  const investorBeforeIrr = nisbaShares.get('INVESTOR') ?? 0n;
  const bankShare = nisbaShares.get('BANK') ?? 0n;
  if (irrUnits > investorBeforeIrr) throw new RangeError('irrAllocation cannot exceed the investor share');
  const investorAfterIrr = investorBeforeIrr - irrUnits;

  const bases = input.participants.map((participant) => ({
    ...participant,
    basis: nonNegativeDecimal(participant.weightedParticipationBase, `weightedParticipationBase:${participant.accountId}`),
  }));
  const accountUnits = input.method === 'WEIGHTED_AVERAGE'
    ? allocateUnits(investorAfterIrr, bases.map((entry) => ({ id: entry.accountId, weight: entry.basis })))
    : allocateByFixedCategoryKey(investorAfterIrr, bases, input.categoryKeys);

  const allocatedTotal = [...accountUnits.values()].reduce((sum, value) => sum + value, 0n);
  const remainder = investorAfterIrr - allocatedTotal;
  if (remainder !== 0n) throw new Error('Moudaraba allocation conservation invariant violated');
  if (bankShare + irrUnits + allocatedTotal !== profitUnits) {
    throw new Error('Moudaraba profit conservation invariant violated');
  }

  return {
    method: input.method,
    profitAfterPer: unitsToDecimal(profitUnits, scale),
    bankShare: unitsToDecimal(bankShare, scale),
    investorShareBeforeIrr: unitsToDecimal(investorBeforeIrr, scale),
    irrAllocation: unitsToDecimal(irrUnits, scale),
    investorShareAfterIrr: unitsToDecimal(investorAfterIrr, scale),
    accountAllocations: bases.map((entry) => ({
      accountId: entry.accountId,
      categoryId: entry.categoryId,
      weightedParticipationBase: entry.weightedParticipationBase,
      allocatedProfit: unitsToDecimal(accountUnits.get(entry.accountId) ?? 0n, scale),
    })),
    unallocatedRemainder: unitsToDecimal(remainder, scale),
  };
}

function allocateByFixedCategoryKey(
  totalUnits: bigint,
  participants: readonly (MoudarabaParticipant & { basis: Decimal })[],
  categoryKeys: readonly MoudarabaCategoryKey[] | undefined,
): Map<string, bigint> {
  if (!categoryKeys?.length) throw new TypeError('categoryKeys are required for FIXED_CATEGORY_KEY');
  assertUnique(categoryKeys.map((entry) => entry.categoryId), 'categoryId');
  const parsedKeys = categoryKeys.map((entry) => ({
    id: entry.categoryId,
    weight: nonNegativeDecimal(entry.allocationKey, `allocationKey:${entry.categoryId}`),
  }));
  if (!parsedKeys.reduce((sum, entry) => sum.plus(entry.weight), new ExactDecimal(0)).equals(1)) {
    throw new RangeError('Fixed category keys must total exactly 1');
  }
  const knownCategories = new Set(parsedKeys.map((entry) => entry.id));
  for (const participant of participants) {
    if (!knownCategories.has(participant.categoryId)) throw new RangeError(`Missing fixed key for category ${participant.categoryId}`);
  }
  for (const key of parsedKeys) {
    if (!participants.some((participant) => participant.categoryId === key.id) && !key.weight.isZero()) {
      throw new RangeError(`Category ${key.id} has a non-zero key but no participant`);
    }
  }

  const categoryUnits = allocateUnits(totalUnits, parsedKeys);
  const result = new Map<string, bigint>();
  for (const key of parsedKeys) {
    const members = participants.filter((participant) => participant.categoryId === key.id);
    if (members.length === 0) continue;
    const allocations = allocateUnits(categoryUnits.get(key.id) ?? 0n, members.map((member) => ({
      id: member.accountId,
      weight: member.basis,
    })));
    for (const [accountId, units] of allocations) result.set(accountId, units);
  }
  return result;
}

function allocateUnits(total: bigint, entries: readonly { id: string; weight: Decimal }[]): Map<string, bigint> {
  if (entries.length === 0) throw new TypeError('At least one allocation weight is required');
  const totalWeight = entries.reduce((sum, entry) => sum.plus(entry.weight), new ExactDecimal(0));
  if (!totalWeight.isPositive()) throw new RangeError('Total allocation weight must be positive');
  const shares = entries.map((entry) => {
    const exact = new ExactDecimal(total.toString()).times(entry.weight).dividedBy(totalWeight);
    const units = BigInt(exact.floor().toFixed(0));
    return { id: entry.id, units, remainder: exact.minus(units.toString()) };
  });
  let residual = total - shares.reduce((sum, entry) => sum + entry.units, 0n);
  const priority = [...shares].sort((left, right) => {
    const remainderOrder = right.remainder.comparedTo(left.remainder);
    return remainderOrder === 0 ? left.id.localeCompare(right.id) : remainderOrder;
  });
  for (let index = 0; residual > 0n; index += 1, residual -= 1n) {
    priority[index % priority.length].units += 1n;
  }
  return new Map(shares.map((entry) => [entry.id, entry.units]));
}

function nonNegativeDecimal(value: string, field: string): Decimal {
  if (!/^(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new TypeError(`${field} must be a canonical non-negative decimal string`);
  return new ExactDecimal(value);
}

function decimalToUnits(value: string, scale: number, field: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new TypeError(`${field} must be a canonical non-negative decimal string`);
  const fraction = match[2] ?? '';
  if (fraction.length > scale) throw new RangeError(`${field} exceeds currency scale ${scale}`);
  return BigInt(`${match[1]}${fraction.padEnd(scale, '0')}`);
}

function unitsToDecimal(units: bigint, scale: number): string {
  const digits = units.toString().padStart(scale + 1, '0');
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function assertUnique(values: readonly string[], field: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) throw new TypeError(`Duplicate or empty ${field}: ${value}`);
    seen.add(value);
  }
}
