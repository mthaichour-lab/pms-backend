import { describe, expect, it } from 'vitest';
import { InvestmentProduct } from '../../../src/modules/products/domain/investment-product.js';

const productId = '550e8400-e29b-41d4-a716-446655440001';

function draft(investorNisba = '70', bankNisba = '30', shariaReference = 'FATWA-2026-01') {
  return InvestmentProduct.draft({ productId, code: 'MUDARABA_01', name: 'Moudaraba standard', investorNisba, bankNisba, shariaReference });
}

describe('InvestmentProduct', () => {
  it('publishes only after validation when Nisba totals 100 and a Sharia reference exists', () => {
    const product = draft();
    product.validate('maker-1', 'Product data reviewed');
    expect(product.pullTransition()).toMatchObject({ fromStatus: 'DRAFT', toStatus: 'VALIDATED', actorId: 'maker-1' });
    product.publish('checker-1', 'Publication approved');
    expect(product.snapshot().status).toBe('PUBLISHED');
    expect(product.pullTransition()).toMatchObject({ fromStatus: 'VALIDATED', toStatus: 'PUBLISHED', actorId: 'checker-1' });
  });

  it('rejects publication when Nisba does not total 100 percent', () => {
    const product = draft('69.999999', '30');
    product.validate('maker-1', 'Product data reviewed');
    expect(() => product.publish('checker-1', 'Publication approved')).toThrow('Nisba must total 100%');
    expect(product.snapshot().status).toBe('VALIDATED');
  });

  it('rejects publication without a Sharia reference', () => {
    const product = draft('70', '30', '');
    product.validate('maker-1', 'Product data reviewed');
    expect(() => product.publish('checker-1', 'Publication approved')).toThrow('Sharia reference');
  });

  it('enforces lifecycle transitions and justification', () => {
    const product = draft();
    expect(() => product.suspend('actor', 'not valid')).toThrow('Cannot transition');
    expect(() => product.validate('actor', 'short')).toThrow('at least 10 characters');
  });
});
