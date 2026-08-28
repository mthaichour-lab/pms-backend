import { Money } from '../../../shared-kernel/money.js';

export interface AllocationWeight {
  participantId: string;
  weight: string;
}

export interface AllocationResult {
  participantId: string;
  amount: string;
  currency: string;
}

const WEIGHT_SCALE = 12;

export function allocateProportionally(
  distributable: Money,
  weights: readonly AllocationWeight[],
): AllocationResult[] {
  if (weights.length === 0) throw new TypeError('At least one allocation weight is required');
  const seen = new Set<string>();
  const normalized = weights.map((entry) => {
    if (!entry.participantId || seen.has(entry.participantId)) {
      throw new TypeError(`Duplicate or empty participant: ${entry.participantId}`);
    }
    seen.add(entry.participantId);
    const weight = decimalToUnits(entry.weight, WEIGHT_SCALE);
    if (weight < 0n) throw new RangeError('Allocation weight cannot be negative');
    return { participantId: entry.participantId, weight };
  });
  const totalWeight = normalized.reduce((sum, entry) => sum + entry.weight, 0n);
  if (totalWeight === 0n) throw new RangeError('Total allocation weight must be positive');

  const signedTotal = distributable.toMinorUnits();
  const sign = signedTotal < 0n ? -1n : 1n;
  const total = signedTotal < 0n ? -signedTotal : signedTotal;
  const shares = normalized.map((entry) => {
    const numerator = total * entry.weight;
    return {
      participantId: entry.participantId,
      units: numerator / totalWeight,
      remainder: numerator % totalWeight,
    };
  });
  let residual = total - shares.reduce((sum, entry) => sum + entry.units, 0n);
  const priority = [...shares].sort((left, right) =>
    left.remainder === right.remainder
      ? left.participantId.localeCompare(right.participantId)
      : left.remainder > right.remainder ? -1 : 1,
  );
  for (let index = 0; residual > 0n; index += 1, residual -= 1n) {
    priority[index % priority.length].units += 1n;
  }
  return shares.map((entry) => ({
    participantId: entry.participantId,
    amount: Money.fromMinorUnits(entry.units * sign, distributable.currency, distributable.scale).toDecimalString(),
    currency: distributable.currency,
  }));
}

function decimalToUnits(value: string, scale: number): bigint {
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(value);
  if (!match) throw new TypeError('Allocation weight must be a canonical decimal string');
  const fraction = match[3] ?? '';
  if (fraction.length > scale) throw new RangeError(`Allocation weight exceeds scale ${scale}`);
  const units = BigInt(`${match[2]}${fraction.padEnd(scale, '0')}`);
  return match[1] === '-' ? -units : units;
}
