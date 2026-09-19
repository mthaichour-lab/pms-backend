import { describe, expect, it, vi } from 'vitest';

import {
  ManageInvestmentSubscription,
  type InvestmentSubscriptionRepository,
  type SubscriptionCommandContext,
} from '../../../src/modules/investment-accounts/application/manage-investment-subscription.js';
import type { InvestmentSubscriptionState } from '../../../src/modules/investment-accounts/domain/investment-subscription.js';

const correlationId = '65aeb69d-73a7-4f04-9578-5fa8326f654f';
const accountId = '17146c36-a0cb-4e0a-b095-60b67c945eb9';
const initial: InvestmentSubscriptionState = {
  accountId,
  customerId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
  productId: 'e958fe1c-6f30-45fa-9819-2239dc953957',
  productTermsVersionId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe',
  contractVersion: 'MUD-2026.3', investorNisba: '70', bankNisba: '30',
  currency: 'DZD', status: 'PRE_SIMULATION',
};

describe('ManageInvestmentSubscription', () => {
  it('enforces START then ACCEPT before ACTIVATE against the transaction-locked state', async () => {
    const repository = memoryRepository(initial);
    const assertRights = vi.fn(async () => undefined);
    const manager = new ManageInvestmentSubscription(repository, {
      assertProfitRightsOperationAllowed: assertRights,
    });

    await manager.act(accountId, {
      type: 'START', businessDate: '2026-09-14', actorId: 'manager-1',
    }, 'subscription-start-0001', correlationId);
    await expect(manager.act(accountId, {
      type: 'ACTIVATE', businessDate: '2026-09-14', actorId: 'manager-1',
    }, 'subscription-activate-early-0001', correlationId)).rejects.toThrow('acceptance');
    await manager.act(accountId, {
      type: 'ACCEPT', businessDate: '2026-09-14', actorId: 'customer-operator',
      acceptedAt: '2026-09-14T08:00:00Z', nonGuaranteeAccepted: true,
      profitSharingMethodAccepted: true,
    }, 'subscription-accept-0001', correlationId);
    await expect(manager.act(accountId, {
      type: 'ACTIVATE', businessDate: '2026-09-14', actorId: 'manager-1',
    }, 'subscription-activate-0001', correlationId)).resolves.toMatchObject({
      status: 'ACTIVE', openedOn: '2026-09-14',
    });
    expect(assertRights).toHaveBeenCalledTimes(2);
    expect(repository.transition).toHaveBeenCalledTimes(4);
  });

  it('validates correlation and idempotency headers before opening a repository transaction', async () => {
    const repository = memoryRepository(initial);
    const manager = new ManageInvestmentSubscription(repository, {
      assertProfitRightsOperationAllowed: vi.fn(),
    });

    await expect(manager.act(accountId, {
      type: 'START', businessDate: '2026-09-14', actorId: 'manager-1',
    }, 'short', correlationId)).rejects.toThrow('Idempotency');
    await expect(manager.act(accountId, {
      type: 'START', businessDate: '2026-09-14', actorId: 'manager-1',
    }, 'subscription-start-0001', 'invalid')).rejects.toThrow('correlation');
    expect(repository.transition).not.toHaveBeenCalled();
  });
});

function memoryRepository(seed: InvestmentSubscriptionState) {
  let state = { ...seed };
  const transition = vi.fn(async (
    _accountId: string,
    _command: SubscriptionCommandContext,
    mutate: Parameters<InvestmentSubscriptionRepository['transition']>[2],
  ) => {
    const result = await mutate({ ...state, acceptance: state.acceptance ? { ...state.acceptance } : undefined });
    state = { ...result.state };
    return { ...state };
  });
  return {
    find: vi.fn(async () => ({ ...state })),
    create: vi.fn(async (created: Readonly<InvestmentSubscriptionState>) => ({ ...created })),
    transition,
  } satisfies InvestmentSubscriptionRepository;
}
