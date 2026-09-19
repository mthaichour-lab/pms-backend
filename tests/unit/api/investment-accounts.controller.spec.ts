import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { InvestmentAccountsController } from '../../../apps/api/src/investment-accounts/investment-accounts.controller.js';
import { GetInvestmentAccountSnapshot } from '../../../src/modules/investment-accounts/application/get-investment-account-snapshot.js';
import { ManageInvestmentSubscription } from '../../../src/modules/investment-accounts/application/manage-investment-subscription.js';

const accountId = '17146c36-a0cb-4e0a-b095-60b67c945eb9';

describe('InvestmentAccountsController', () => {
  const controller = new InvestmentAccountsController(new GetInvestmentAccountSnapshot({
    findSnapshot: async (id) => id === accountId ? {
      accountId: id, productCode: 'MUDARABA', currency: 'DZD',
      openedOn: '2026-01-01', status: 'ACTIVE',
      position: { businessDate: '2026-08-28', valueDate: '2026-08-28', balance: '1250.000000000000', currency: 'DZD' },
    } : undefined,
  }), new ManageInvestmentSubscription({
    find: async () => undefined,
    create: async (state) => ({ ...state }),
    transition: async () => { throw new Error('not used'); },
  }, { assertProfitRightsOperationAllowed: async () => undefined }));

  it('returns an account and its applicable position', async () => {
    await expect(controller.getAccount(accountId, '2026-08-28')).resolves.toMatchObject({
      accountId, position: { balance: '1250.000000000000' },
    });
  });

  it('maps invalid identifiers and absent accounts to explicit errors', async () => {
    await expect(controller.getAccount('raw-account', '2026-08-28')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getAccount('a1d817e4-657f-475f-a96a-7eecb8f93acc', '2026-08-28')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a subscription command without the required correlation header', async () => {
    await expect(controller.createSubscription({
      accountId,
      customerId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
      productId: 'e958fe1c-6f30-45fa-9819-2239dc953957',
      productTermsVersionId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe',
      contractVersion: 'MUD-2026.3', investorNisba: '70', bankNisba: '30', currency: 'DZD',
    }, 'subscription-create-0001', undefined, { sub: 'manager-1' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});
