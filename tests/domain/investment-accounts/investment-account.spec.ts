import { describe, expect, it } from 'vitest';

import { InvestmentAccount } from '../../../src/modules/investment-accounts/domain/investment-account.js';

const input = {
  accountId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
  customerToken: 'tok_1234567890abcdef', productCode: 'MUDARABA',
  currency: 'DZD', openedOn: '2026-01-01',
};

describe('InvestmentAccount', () => {
  it('enforces controlled lifecycle transitions', () => {
    const account = InvestmentAccount.open(input);
    account.suspend();
    account.reactivate();
    account.close('2026-08-28');
    expect(account.snapshot()).toMatchObject({ status: 'CLOSED', closedOn: '2026-08-28' });
    expect(() => account.reactivate()).toThrow('CLOSED');
  });

  it('rejects raw customer identifiers and impossible closing dates', () => {
    expect(() => InvestmentAccount.open({ ...input, customerToken: 'customer-42' })).toThrow('tokenized');
    const account = InvestmentAccount.open(input);
    expect(() => account.close('2025-12-31')).toThrow('before opening');
  });
});
