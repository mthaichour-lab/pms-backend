import { describe, expect, it, vi } from 'vitest';

import { PostgresInvestmentSubscriptionRepository } from '../../../src/infrastructure/persistence/postgres-investment-subscription.repository.js';
import type { InvestmentSubscriptionState } from '../../../src/modules/investment-accounts/domain/investment-subscription.js';

const accountId = '17146c36-a0cb-4e0a-b095-60b67c945eb9';
const correlationId = '65aeb69d-73a7-4f04-9578-5fa8326f654f';
const pending: InvestmentSubscriptionState = {
  accountId,
  customerId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
  productId: 'e958fe1c-6f30-45fa-9819-2239dc953957',
  productTermsVersionId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe',
  contractVersion: 'MUD-2026.3', investorNisba: '70.000000', bankNisba: '30.000000',
  currency: 'DZD', status: 'PENDING_SUBSCRIPTION',
  acceptance: {
    acceptedAt: '2026-09-14T08:00:00Z', acceptedBy: 'customer-operator',
    nonGuaranteeAccepted: true, profitSharingMethodAccepted: true,
  },
};
const command = {
  idempotencyKey: 'subscription-activate-0001', correlationId,
  operation: 'ACTIVATE_INVESTMENT_SUBSCRIPTION', requestHash: 'a'.repeat(64),
  actorId: 'relationship-manager', justification: 'Investment subscription action ACTIVATE',
};

describe('PostgresInvestmentSubscriptionRepository', () => {
  it('locks the current account and writes event, audit outbox and command outcome before commit', async () => {
    const query = vi.fn(async (sql: string, _values?: unknown[]) => {
      if (sql.includes('FROM investment.subscription_command')) return { rows: [] };
      if (sql.includes('FROM investment.subscription_account') && sql.includes('FOR UPDATE')) {
        return { rows: [row(pending)] };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const repository = new PostgresInvestmentSubscriptionRepository({
      connect: async () => ({ query, release }), query,
    } as never);
    const active = { ...pending, status: 'ACTIVE' as const, openedOn: '2026-09-14' };

    await expect(repository.transition(accountId, command, async (locked) => {
      expect(locked.status).toBe('PENDING_SUBSCRIPTION');
      return {
        state: active,
        events: [{ type: 'ACTIVATED', businessDate: '2026-09-14', actorId: command.actorId, details: {} }],
      };
    })).resolves.toMatchObject({ status: 'ACTIVE', openedOn: '2026-09-14' });

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toBe('BEGIN');
    expect(statements[1]).toContain('pg_advisory_xact_lock');
    const lockIndex = statements.findIndex((sql) => sql.includes('FOR UPDATE'));
    const updateIndex = statements.findIndex((sql) => sql.startsWith('UPDATE investment.subscription_account'));
    const eventIndex = statements.findIndex((sql) => sql.includes('INSERT INTO investment.subscription_event'));
    const outboxIndex = statements.findIndex((sql) => sql.includes('INSERT INTO integration.outbox_event'));
    const commandIndex = statements.findIndex((sql) => sql.includes('INSERT INTO investment.subscription_command'));
    const commitIndex = statements.indexOf('COMMIT');
    expect(lockIndex).toBeGreaterThan(1);
    expect(updateIndex).toBeGreaterThan(lockIndex);
    expect(eventIndex).toBeGreaterThan(updateIndex);
    expect(outboxIndex).toBeGreaterThan(eventIndex);
    expect(commandIndex).toBeGreaterThan(outboxIndex);
    expect(commitIndex).toBeGreaterThan(commandIndex);
    expect(query.mock.calls[outboxIndex]?.[1]).toEqual([
      accountId, correlationId, command.operation, command.actorId,
      command.justification, 'ACTIVE', '2026-09-14',
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('returns the immutable original outcome on an identical replay without mutating or emitting', async () => {
    const original = { ...pending, status: 'ACTIVE' as const, openedOn: '2026-09-14' };
    const query = vi.fn(async (sql: string) => sql.includes('FROM investment.subscription_command')
      ? { rows: [{ account_id: accountId, operation: command.operation, request_hash: command.requestHash, result_snapshot: original }] }
      : { rows: [], rowCount: 1 });
    const release = vi.fn();
    const repository = new PostgresInvestmentSubscriptionRepository({ connect: async () => ({ query, release }), query } as never);
    const mutate = vi.fn();

    await expect(repository.transition(accountId, command, mutate)).resolves.toEqual(original);
    expect(mutate).not.toHaveBeenCalled();
    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual([
      'BEGIN', expect.stringContaining('pg_advisory_xact_lock'),
      expect.stringContaining('FROM investment.subscription_command'), 'COMMIT',
    ]);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('integration.outbox_event'))).toBe(false);
  });

  it('rejects reuse of a key with another payload and rolls back', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('FROM investment.subscription_command')
      ? { rows: [{ account_id: accountId, operation: command.operation, request_hash: 'b'.repeat(64), result_snapshot: pending }] }
      : { rows: [], rowCount: 1 });
    const release = vi.fn();
    const repository = new PostgresInvestmentSubscriptionRepository({ connect: async () => ({ query, release }), query } as never);

    await expect(repository.transition(accountId, command, vi.fn())).rejects.toThrow('different subscription command');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });
});

function row(state: InvestmentSubscriptionState) {
  return {
    account_id: state.accountId, customer_id: state.customerId, product_id: state.productId,
    product_terms_version_id: state.productTermsVersionId, contract_version: state.contractVersion,
    investor_nisba: state.investorNisba, bank_nisba: state.bankNisba, currency_code: state.currency,
    status: state.status, opened_on: state.openedOn ?? null, maturity_date: state.maturityDate ?? null,
    closed_on: state.closedOn ?? null, accepted_at: state.acceptance?.acceptedAt ?? null,
    accepted_by: state.acceptance?.acceptedBy ?? null,
    non_guarantee_accepted: state.acceptance?.nonGuaranteeAccepted ?? false,
    profit_sharing_method_accepted: state.acceptance?.profitSharingMethodAccepted ?? false,
  };
}
