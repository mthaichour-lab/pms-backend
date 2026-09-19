import type { Pool, PoolClient } from 'pg';

import type {
  InvestmentSubscriptionRepository,
  SubscriptionCommandContext,
  SubscriptionMutation,
} from '../../modules/investment-accounts/application/manage-investment-subscription.js';
import type {
  InvestmentSubscriptionState,
  SubscriptionEvent,
} from '../../modules/investment-accounts/domain/investment-subscription.js';

export class PostgresInvestmentSubscriptionRepository implements InvestmentSubscriptionRepository {
  constructor(private readonly pool: Pick<Pool, 'connect' | 'query'>) {}

  async find(accountId: string): Promise<InvestmentSubscriptionState | undefined> {
    const result = await this.pool.query<SubscriptionRow>(`${selectSubscription} WHERE account_id=$1::uuid`, [accountId]);
    return result.rows[0] ? mapSubscription(result.rows[0]) : undefined;
  }

  async create(
    state: Readonly<InvestmentSubscriptionState>,
    events: readonly SubscriptionEvent[],
    command: SubscriptionCommandContext,
  ): Promise<InvestmentSubscriptionState> {
    return this.withTransaction(async (client) => {
      await lockCommand(client, command.idempotencyKey);
      const replay = await findReplay(client, state.accountId, command);
      if (replay) return replay;

      await client.query(
        `INSERT INTO investment.subscription_account(
           account_id, customer_id, product_id, product_terms_version_id, contract_version,
           investor_nisba, bank_nisba, currency_code, status, opened_on, maturity_date,
           closed_on, accepted_at, accepted_by, non_guarantee_accepted,
           profit_sharing_method_accepted
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::numeric, $7::numeric, $8, $9,
           $10::date, $11::date, $12::date, $13::timestamptz, $14, $15, $16
         )`, stateValues(state),
      );
      await appendEvents(client, state.accountId, events, command.idempotencyKey);
      await appendAuditIntent(client, state, events, command);
      await insertCommand(client, state, command);
      return { ...state, acceptance: state.acceptance ? { ...state.acceptance } : undefined };
    });
  }

  async transition(
    accountId: string,
    command: SubscriptionCommandContext,
    mutate: (state: InvestmentSubscriptionState) => Promise<SubscriptionMutation>,
  ): Promise<InvestmentSubscriptionState> {
    return this.withTransaction(async (client) => {
      await lockCommand(client, command.idempotencyKey);
      const replay = await findReplay(client, accountId, command);
      if (replay) return replay;

      const current = await client.query<SubscriptionRow>(`${selectSubscription} WHERE account_id=$1::uuid FOR UPDATE`, [accountId]);
      if (!current.rows[0]) throw new Error(`Investment subscription not found: ${accountId}`);

      const mutation = await mutate(mapSubscription(current.rows[0]));
      if (mutation.events.length !== 1) throw new Error('A subscription command must emit exactly one domain event');
      await client.query(
        `UPDATE investment.subscription_account SET
           status=$2, opened_on=$3::date, maturity_date=$4::date, closed_on=$5::date,
           accepted_at=$6::timestamptz, accepted_by=$7, non_guarantee_accepted=$8,
           profit_sharing_method_accepted=$9, updated_at=clock_timestamp()
         WHERE account_id=$1::uuid`,
        [accountId, mutation.state.status, mutation.state.openedOn ?? null,
          mutation.state.maturityDate ?? null, mutation.state.closedOn ?? null,
          mutation.state.acceptance?.acceptedAt ?? null, mutation.state.acceptance?.acceptedBy ?? null,
          mutation.state.acceptance?.nonGuaranteeAccepted ?? false,
          mutation.state.acceptance?.profitSharingMethodAccepted ?? false],
      );
      await appendEvents(client, accountId, mutation.events, command.idempotencyKey);
      await appendAuditIntent(client, mutation.state, mutation.events, command);
      await insertCommand(client, mutation.state, command);
      return {
        ...mutation.state,
        acceptance: mutation.state.acceptance ? { ...mutation.state.acceptance } : undefined,
      };
    });
  }

  private async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

const subscriptionColumns = `account_id::text, customer_id::text, product_id::text,
  product_terms_version_id::text, contract_version, investor_nisba::text, bank_nisba::text,
  currency_code, status, opened_on::text, maturity_date::text, closed_on::text,
  accepted_at::text, accepted_by, non_guarantee_accepted, profit_sharing_method_accepted`;
const selectSubscription = `SELECT ${subscriptionColumns} FROM investment.subscription_account`;

interface SubscriptionRow {
  account_id: string;
  customer_id: string;
  product_id: string;
  product_terms_version_id: string;
  contract_version: string;
  investor_nisba: string;
  bank_nisba: string;
  currency_code: string;
  status: InvestmentSubscriptionState['status'];
  opened_on: string | null;
  maturity_date: string | null;
  closed_on: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  non_guarantee_accepted: boolean;
  profit_sharing_method_accepted: boolean;
}

function mapSubscription(row: SubscriptionRow): InvestmentSubscriptionState {
  return {
    accountId: row.account_id,
    customerId: row.customer_id,
    productId: row.product_id,
    productTermsVersionId: row.product_terms_version_id,
    contractVersion: row.contract_version,
    investorNisba: row.investor_nisba,
    bankNisba: row.bank_nisba,
    currency: row.currency_code,
    status: row.status,
    ...(row.opened_on ? { openedOn: row.opened_on } : {}),
    ...(row.maturity_date ? { maturityDate: row.maturity_date } : {}),
    ...(row.closed_on ? { closedOn: row.closed_on } : {}),
    ...(row.accepted_at ? { acceptance: {
      acceptedAt: row.accepted_at,
      acceptedBy: row.accepted_by ?? '',
      nonGuaranteeAccepted: row.non_guarantee_accepted,
      profitSharingMethodAccepted: row.profit_sharing_method_accepted,
    } } : {}),
  };
}

function stateValues(state: Readonly<InvestmentSubscriptionState>): unknown[] {
  return [state.accountId, state.customerId, state.productId, state.productTermsVersionId,
    state.contractVersion, state.investorNisba, state.bankNisba, state.currency, state.status,
    state.openedOn ?? null, state.maturityDate ?? null, state.closedOn ?? null,
    state.acceptance?.acceptedAt ?? null, state.acceptance?.acceptedBy ?? null,
    state.acceptance?.nonGuaranteeAccepted ?? false,
    state.acceptance?.profitSharingMethodAccepted ?? false];
}

async function lockCommand(client: PoolClient, idempotencyKey: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [idempotencyKey]);
}

async function findReplay(
  client: PoolClient,
  accountId: string,
  command: SubscriptionCommandContext,
): Promise<InvestmentSubscriptionState | undefined> {
  const result = await client.query<{
    account_id: string; operation: string; request_hash: string; result_snapshot: InvestmentSubscriptionState;
  }>(
    `SELECT account_id::text, operation, request_hash, result_snapshot
     FROM investment.subscription_command WHERE idempotency_key=$1`, [command.idempotencyKey],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  if (row.account_id !== accountId || row.operation !== command.operation || row.request_hash !== command.requestHash) {
    throw new Error('Idempotency key was already used for a different subscription command');
  }
  return row.result_snapshot;
}

async function appendEvents(
  client: PoolClient,
  accountId: string,
  events: readonly SubscriptionEvent[],
  idempotencyKey: string,
): Promise<void> {
  for (const [eventIndex, event] of events.entries()) {
    await client.query(
      `INSERT INTO investment.subscription_event(
         account_id, event_type, business_date, actor_id, details, idempotency_key
       ) VALUES($1::uuid, $2, $3::date, $4, $5::jsonb, $6)`,
      [accountId, event.type, event.businessDate, event.actorId,
        JSON.stringify(event.details), `${idempotencyKey}:${eventIndex}`],
    );
  }
}

async function appendAuditIntent(
  client: PoolClient,
  state: Readonly<InvestmentSubscriptionState>,
  events: readonly SubscriptionEvent[],
  command: SubscriptionCommandContext,
): Promise<void> {
  const businessDate = events[0]?.businessDate;
  if (!businessDate) throw new Error('Subscription audit intent requires a business date');
  await client.query(
    `INSERT INTO integration.outbox_event(
       event_id, aggregate_type, aggregate_id, event_type, schema_version,
       correlation_id, payload, occurred_at
     ) VALUES(
       gen_random_uuid(), 'InvestmentSubscription', $1, 'pms.audit.workflow-action-recorded.v1', 1,
       $2::uuid, jsonb_build_object(
         'resourceType', 'InvestmentSubscription', 'resourceId', $1,
         'action', $3, 'actorId', $4, 'justification', $5,
         'resultState', $6, 'businessDate', $7
       ), clock_timestamp()
     )`,
    [state.accountId, command.correlationId, command.operation, command.actorId,
      command.justification, state.status, businessDate],
  );
}

async function insertCommand(
  client: PoolClient,
  state: Readonly<InvestmentSubscriptionState>,
  command: SubscriptionCommandContext,
): Promise<void> {
  await client.query(
    `INSERT INTO investment.subscription_command(
       idempotency_key, account_id, operation, request_hash, correlation_id, result_snapshot
     ) VALUES($1, $2::uuid, $3, $4, $5::uuid, $6::jsonb)`,
    [command.idempotencyKey, state.accountId, command.operation, command.requestHash,
      command.correlationId, JSON.stringify(state)],
  );
}
