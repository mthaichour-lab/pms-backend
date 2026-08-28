import { describe, expect, it } from 'vitest';

import { Money } from '../../../src/shared-kernel/money.js';

describe('Money', () => {
  it('adds and subtracts decimal amounts without floating point', () => {
    const result = Money.parse('0.10', 'DZD', 2).add(Money.parse('0.20', 'DZD', 2));
    expect(result.toDecimalString()).toBe('0.30');
    expect(result.subtract(Money.parse('1.00', 'DZD', 2)).toDecimalString()).toBe('-0.70');
  });

  it('rejects precision loss and cross-currency arithmetic', () => {
    expect(() => Money.parse('1.001', 'DZD', 2)).toThrow('scale');
    expect(() => Money.parse('1.00', 'DZD', 2).add(Money.parse('1.00', 'EUR', 2))).toThrow('identical');
  });
});
