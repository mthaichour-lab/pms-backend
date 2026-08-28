import { describe, expect, it } from 'vitest';

import { allocateProportionally } from '../../../src/modules/profit-calculation/domain/proportional-allocation.js';
import { Money } from '../../../src/shared-kernel/money.js';

describe('proportional profit allocation', () => {
  it('conserves every minor unit with deterministic largest-remainder rounding', () => {
    const allocations = allocateProportionally(Money.parse('100.00', 'DZD', 2), [
      { participantId: 'account-b', weight: '1' },
      { participantId: 'account-a', weight: '1' },
      { participantId: 'account-c', weight: '1' },
    ]);
    expect(allocations).toEqual([
      { participantId: 'account-b', amount: '33.33', currency: 'DZD' },
      { participantId: 'account-a', amount: '33.34', currency: 'DZD' },
      { participantId: 'account-c', amount: '33.33', currency: 'DZD' },
    ]);
    expect(allocations.reduce((sum, item) => sum.add(Money.parse(item.amount, 'DZD', 2)), Money.parse('0', 'DZD', 2)).toDecimalString()).toBe('100.00');
  });

  it('allocates losses symmetrically and rejects zero total weight', () => {
    expect(allocateProportionally(Money.parse('-1.00', 'DZD', 2), [
      { participantId: 'a', weight: '1' }, { participantId: 'b', weight: '1' },
    ]).map((entry) => entry.amount)).toEqual(['-0.50', '-0.50']);
    expect(() => allocateProportionally(Money.parse('1.00', 'DZD', 2), [
      { participantId: 'a', weight: '0' },
    ])).toThrow('positive');
  });
});
