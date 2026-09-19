import { describe, expect, it } from 'vitest';

import { InvestmentSubscription } from '../../../src/modules/investment-accounts/domain/investment-subscription.js';

const input = {
  accountId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
  customerId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
  productId: 'e958fe1c-6f30-45fa-9819-2239dc953957',
  productTermsVersionId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe',
  contractVersion: 'MUD-2026.3',
  investorNisba: '70',
  bankNisba: '30',
  currency: 'DZD',
};

describe('InvestmentSubscription', () => {
  it('refuses activation without explicit double acceptance', () => {
    const account = InvestmentSubscription.presimulate(input);
    account.startSubscription('2026-08-29', 'maker');
    expect(() => account.activate('2026-08-29', 'maker')).toThrow('acceptance');
    expect(() => account.acceptTerms({
      acceptedAt: '2026-08-29T10:00:00Z', acceptedBy: 'customer',
      nonGuaranteeAccepted: true, profitSharingMethodAccepted: false,
    })).toThrow('Explicit');
  });

  it('freezes subscribed contract terms through renewals and closing', () => {
    const account = InvestmentSubscription.presimulate(input);
    account.startSubscription('2026-08-29', 'maker');
    account.acceptTerms({
      acceptedAt: '2026-08-29T10:00:00Z', acceptedBy: 'customer',
      nonGuaranteeAccepted: true, profitSharingMethodAccepted: true,
    });
    account.activate('2026-08-29', 'maker');
    account.renew('2026-08-30', 'maker', '2027-08-30');
    account.close('2026-08-31', 'maker');
    expect(account.snapshot()).toMatchObject({
      status: 'CLOSED', contractVersion: 'MUD-2026.3', investorNisba: '70', closedOn: '2026-08-31',
    });
    expect(account.pendingEvents().map((event) => event.type)).toContain('CLOSED');
  });

  it('validates Nisba with canonical fixed-point arithmetic', () => {
    expect(() => InvestmentSubscription.presimulate({ ...input, investorNisba: '75' })).toThrow('100');
    for (const investorNisba of ['070', '.70', '7e1', '70.0000000']) {
      expect(() => InvestmentSubscription.presimulate({ ...input, investorNisba })).toThrow('canonical');
    }
    expect(() => InvestmentSubscription.presimulate({
      ...input, investorNisba: '69.999999', bankNisba: '30.000001',
    })).not.toThrow();
  });

  it('does not hydrate lifecycle evidence from unexpected create payload fields', () => {
    const account = InvestmentSubscription.presimulate({
      ...input,
      status: 'ACTIVE',
      acceptance: {
        acceptedAt: '2026-09-14T08:00:00Z', acceptedBy: 'attacker',
        nonGuaranteeAccepted: true, profitSharingMethodAccepted: true,
      },
    } as never);
    expect(account.snapshot()).toMatchObject({ status: 'PRE_SIMULATION' });
    expect(account.snapshot().acceptance).toBeUndefined();
  });

  it('rejects non-canonical amounts and impossible calendar dates', () => {
    const account = activeAccount();
    for (const amount of ['.5', '01', '1e2', '0', '1.0000000000000']) {
      expect(() => account.deposit('2026-08-29', 'maker', amount)).toThrow('canonical');
    }
    expect(() => account.deposit('2026-02-30', 'maker', '1.25')).toThrow('business date');
    expect(() => account.renew('2026-08-29', 'maker', '2027-02-29')).toThrow('business date');
    expect(() => InvestmentSubscription.presimulate({ ...input, maturityDate: '2026-02-30' })).toThrow('business date');
  });

  it('rejects impossible or non-ISO acceptance timestamps', () => {
    const account = InvestmentSubscription.presimulate(input);
    account.startSubscription('2026-08-29', 'maker');
    for (const acceptedAt of ['2026-02-30T10:00:00Z', 'August 29, 2026']) {
      expect(() => account.acceptTerms({
        acceptedAt, acceptedBy: 'customer', nonGuaranteeAccepted: true,
        profitSharingMethodAccepted: true,
      })).toThrow('acceptance');
    }
    expect(() => account.acceptTerms({
      acceptedAt: '2026-08-29T10:00:00Z', acceptedBy: 'customer',
      nonGuaranteeAccepted: true, profitSharingMethodAccepted: true,
    }, '2026-02-30')).toThrow('business date');
  });
});

function activeAccount(): InvestmentSubscription {
  const account = InvestmentSubscription.presimulate(input);
  account.startSubscription('2026-08-29', 'maker');
  account.acceptTerms({
    acceptedAt: '2026-08-29T10:00:00Z', acceptedBy: 'customer',
    nonGuaranteeAccepted: true, profitSharingMethodAccepted: true,
  });
  account.activate('2026-08-29', 'maker');
  return account;
}
