import type { Pool, PoolClient } from 'pg';

import {
  CalculationInitiationError,
  type CalculationInitiationRepository,
  type CalculationInitiationResult,
  type InitiateCalculationRequest,
  type ParticipantWeightBasis,
} from '../../modules/profit-calculation/application/initiate-profit-calculation.js';

interface PoolRow { currency_code: string; }
interface ParticipantRow { account_id: string; weight: string; }

export class PostgresCalculationInitiationRepository implements CalculationInitiationRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async prepareAndEnqueueAtomically(
    request: InitiateCalculationRequest,
  ): Promise<CalculationInitiationResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `pms.calculation.initiate.${request.poolId}.${request.businessDate}.${request.rulesVersion}`,
      ]);

      const replay = await findReplay(client, request);
      if (replay) {
        await client.query('COMMIT');
        return replay;
      }

      const pool = await loadActivePool(client, request.poolId);
      await prepareParticipants(client, request, pool.currency_code);
      await prepareDistributableResult(client, request, pool.currency_code);
      await insertRunAndOutbox(client, request);
      await client.query('COMMIT');
      return { runId: request.runId, status: 'DRAFT', dispatchStatus: 'QUEUED' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function findReplay(
  client: PoolClient,
  request: InitiateCalculationRequest,
): Promise<CalculationInitiationResult | undefined> {
  const result = await client.query<{
    run_id: string; pool_id: string; business_date: string; rules_version: string;
    correlation_id: string; maker_id: string | null; run_kind: string; status: string;
  }>(
    `SELECT run_id::text, pool_id, business_date::text, rules_version,
            correlation_id::text, maker_id, run_kind, status
       FROM calculation.run
      WHERE run_id = $1::uuid OR
            (pool_id = $2 AND business_date = $3::date AND rules_version = $4 AND revision = 1)
      FOR UPDATE`,
    [request.runId, request.poolId, request.businessDate, request.rulesVersion],
  );
  const run = result.rows[0];
  if (!run) return undefined;
  const sameRequest = run.run_id === request.runId && run.pool_id === request.poolId &&
    run.business_date === request.businessDate && run.rules_version === request.rulesVersion &&
    run.correlation_id === request.correlationId && run.maker_id === request.requestedBy &&
    run.run_kind === (request.runKind ?? 'PARALLEL');
  if (!sameRequest) {
    throw new CalculationInitiationError(
      'CALCULATION_RUN_CONFLICT',
      'A calculation run already exists for this identifier or business basis',
      'USE_EXISTING_RUN_OR_NEW_REVISION',
    );
  }
  if (run.status !== 'DRAFT') {
    throw new CalculationInitiationError(
      'CALCULATION_RUN_CONFLICT',
      `Calculation run cannot be queued from ${run.status}`,
      'USE_EXISTING_RUN_OR_NEW_REVISION',
    );
  }
  return { runId: run.run_id, status: 'DRAFT', dispatchStatus: 'ALREADY_QUEUED' };
}

async function loadActivePool(client: PoolClient, poolId: string): Promise<PoolRow> {
  const result = await client.query<PoolRow>(
    `SELECT currency_code FROM pooling.pool WHERE pool_id = $1 AND status = 'ACTIVE' FOR SHARE`,
    [poolId],
  );
  if (!result.rows[0]) {
    throw new CalculationInitiationError(
      'POOL_NOT_ACTIVE',
      `Pool is missing or inactive: ${poolId}`,
      'ACTIVATE_POOL',
    );
  }
  return result.rows[0];
}

async function prepareParticipants(
  client: PoolClient,
  request: InitiateCalculationRequest,
  currency: string,
): Promise<void> {
  const existing = await client.query<{ total: string; eligible: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE account.status = 'ACTIVE'
              AND subscription.status = 'ACTIVE'
              AND subscription.non_guarantee_accepted
              AND subscription.profit_sharing_method_accepted
              AND subscription.opened_on <= $2::date
              AND (subscription.maturity_date IS NULL OR subscription.maturity_date >= $2::date)
              AND participant.weight > 0)::text AS eligible
       FROM pooling.participant_version participant
       LEFT JOIN investment.account account ON account.account_id = participant.account_id
       LEFT JOIN investment.subscription_account subscription ON subscription.account_id = participant.account_id
      WHERE participant.pool_id = $1 AND participant.currency_code = $3
        AND participant.valid_from <= $2::date
        AND (participant.valid_until IS NULL OR participant.valid_until > $2::date)`,
    [request.poolId, request.businessDate, currency],
  );
  const total = Number(existing.rows[0]?.total ?? '0');
  const eligible = Number(existing.rows[0]?.eligible ?? '0');
  if (total > 0) {
    if (eligible !== total) {
      throw new CalculationInitiationError(
        'PARTICIPANT_BASIS_INVALID',
        'Existing pool participants are not all active, accepted and positively weighted',
        'REVIEW_POOL_PARTICIPANTS',
      );
    }
    return;
  }

  const participants = await loadActiveSubscriptions(
    client,
    request.businessDate,
    currency,
    request.participantBasis.weightBasis,
  );
  if (participants.length === 0) {
    throw new CalculationInitiationError(
      'PARTICIPANT_BASIS_UNAVAILABLE',
      `No active accepted subscription with a positive ${request.participantBasis.weightBasis} weight`,
      request.participantBasis.weightBasis === 'LATEST_POSITION'
        ? 'LOAD_INVESTMENT_POSITIONS'
        : 'RECORD_SUBSCRIPTION_DEPOSITS',
    );
  }
  for (const participant of participants) {
    await client.query(
      `INSERT INTO pooling.participant_version
         (pool_id, account_id, currency_code, weight, valid_from)
       VALUES($1, $2::uuid, $3, $4::numeric, $5::date)`,
      [request.poolId, participant.account_id, currency, participant.weight, request.businessDate],
    );
  }
}

async function loadActiveSubscriptions(
  client: PoolClient,
  businessDate: string,
  currency: string,
  basis: ParticipantWeightBasis,
): Promise<readonly ParticipantRow[]> {
  const weightJoin = basis === 'LATEST_POSITION'
    ? `JOIN LATERAL (
         SELECT position.balance::text AS weight
           FROM investment.position_snapshot position
          WHERE position.account_id = account.account_id
            AND position.currency_code = account.currency_code
            AND position.business_date <= $1::date
          ORDER BY position.business_date DESC, position.value_date DESC, position.created_at DESC
          LIMIT 1
       ) weight ON weight.weight::numeric > 0`
    : `JOIN LATERAL (
         SELECT COALESCE(sum(CASE event.event_type
           WHEN 'DEPOSIT' THEN (event.details->>'amount')::numeric
           WHEN 'WITHDRAWAL' THEN -(event.details->>'amount')::numeric
           ELSE 0 END), 0)::text AS weight
           FROM investment.subscription_event event
          WHERE event.account_id = subscription.account_id
            AND event.business_date <= $1::date
       ) weight ON weight.weight::numeric > 0`;
  const result = await client.query<ParticipantRow>(
    `SELECT account.account_id::text, weight.weight
       FROM investment.subscription_account subscription
       JOIN investment.account account ON account.account_id = subscription.account_id
       ${weightJoin}
      WHERE subscription.status = 'ACTIVE'
        AND subscription.currency_code = $2
        AND subscription.non_guarantee_accepted
        AND subscription.profit_sharing_method_accepted
        AND subscription.opened_on <= $1::date
        AND (subscription.maturity_date IS NULL OR subscription.maturity_date >= $1::date)
        AND account.status = 'ACTIVE'
        AND account.currency_code = subscription.currency_code
        AND account.opened_on <= $1::date
        AND (account.closed_on IS NULL OR account.closed_on > $1::date)
      ORDER BY account.account_id`,
    [businessDate, currency],
  );
  return result.rows;
}

async function prepareDistributableResult(
  client: PoolClient,
  request: InitiateCalculationRequest,
  currency: string,
): Promise<void> {
  const existing = await client.query<{ amount: string }>(
    `SELECT amount::text FROM pooling.distributable_result
      WHERE pool_id = $1 AND business_date = $2::date AND currency_code = $3 FOR SHARE`,
    [request.poolId, request.businessDate, currency],
  );
  if (existing.rows[0]) return;

  const ungovernedCharges = await client.query<{ source_reference: string }>(
    `SELECT charge.source_reference
       FROM revenue.pool_charge charge
      WHERE charge.pool_id = $1 AND charge.business_date = $2::date
        AND charge.currency_code = $3
        AND NOT EXISTS (
          SELECT 1 FROM revenue.charge_policy policy
           WHERE policy.category_code = charge.category_code
             AND policy.effective_from <= charge.business_date
             AND (policy.effective_to IS NULL OR policy.effective_to >= charge.business_date)
        )
      ORDER BY charge.source_reference`,
    [request.poolId, request.businessDate, currency],
  );
  if (ungovernedCharges.rows.length > 0) {
    throw new CalculationInitiationError(
      'CHARGE_POLICY_MISSING',
      `Charges have no effective accountability policy: ${ungovernedCharges.rows.map(row => row.source_reference).join(', ')}`,
      'CONFIGURE_CHARGE_POLICY',
    );
  }

  const result = await client.query<{
    income_count: string; income_amount: string; charge_amount: string; distributable_amount: string;
    source_fingerprint: string;
  }>(
    `WITH income_adjustments AS (
       SELECT adjustment.income_id, sum(adjustment.amount) AS amount
         FROM revenue.income_adjustment adjustment
        WHERE adjustment.business_date <= $2::date
        GROUP BY adjustment.income_id
     ), income AS (
       SELECT count(*) AS income_count,
              COALESCE(sum(recognized.amount + COALESCE(adjustment.amount, 0)), 0) AS amount,
              COALESCE(jsonb_agg(jsonb_build_array(recognized.income_id::text,
                recognized.amount::text, COALESCE(adjustment.amount, 0)::text)
                ORDER BY recognized.income_id), '[]'::jsonb) AS sources
         FROM revenue.recognized_income recognized
         LEFT JOIN income_adjustments adjustment ON adjustment.income_id = recognized.income_id
        WHERE recognized.pool_id = $1 AND recognized.business_date = $2::date
          AND recognized.currency_code = $3 AND recognized.realization_status = 'REALIZED'
     ), governed_charges AS (
       SELECT charge.charge_id, charge.amount,
              (SELECT policy.responsibility FROM revenue.charge_policy policy
                WHERE policy.category_code = charge.category_code
                  AND policy.effective_from <= charge.business_date
                  AND (policy.effective_to IS NULL OR policy.effective_to >= charge.business_date)
                ORDER BY policy.version DESC LIMIT 1) AS responsibility
         FROM revenue.pool_charge charge
        WHERE charge.pool_id = $1 AND charge.business_date = $2::date
          AND charge.currency_code = $3
     ), charges AS (
       SELECT COALESCE(sum(amount) FILTER (WHERE responsibility = 'POOL'), 0) AS amount,
              COALESCE(jsonb_agg(jsonb_build_array(charge_id::text, amount::text, responsibility)
                ORDER BY charge_id), '[]'::jsonb) AS sources
         FROM governed_charges
     )
     SELECT income.income_count::text, income.amount::text AS income_amount,
            charges.amount::text AS charge_amount,
            (income.amount - charges.amount)::text AS distributable_amount,
            encode(digest(jsonb_build_object('income', income.sources, 'charges', charges.sources)::text,
              'sha256'), 'hex') AS source_fingerprint
       FROM income CROSS JOIN charges`,
    [request.poolId, request.businessDate, currency],
  );
  const amounts = result.rows[0];
  if (!amounts || Number(amounts.income_count) === 0) {
    throw new CalculationInitiationError(
      'RECOGNIZED_INCOME_UNAVAILABLE',
      'No realized recognized income exists for the pool and business date',
      'RECOGNIZE_POOL_INCOME',
    );
  }
  if (!isPositiveDecimal(amounts.distributable_amount)) {
    throw new CalculationInitiationError(
      'DISTRIBUTABLE_AMOUNT_NOT_POSITIVE',
      `Recognized income ${amounts.income_amount} minus pool charges ${amounts.charge_amount} is not positive`,
      'REVIEW_RECOGNIZED_INCOME_AND_CHARGES',
    );
  }
  await client.query(
    `INSERT INTO pooling.distributable_result
       (pool_id, business_date, amount, currency_code, source_reference)
     VALUES($1, $2::date, $3::numeric, $4, $5)`,
    [request.poolId, request.businessDate, amounts.distributable_amount, currency,
      `REVENUE_CHARGES_SHA256:${amounts.source_fingerprint}`],
  );
}

async function insertRunAndOutbox(client: PoolClient, request: InitiateCalculationRequest): Promise<void> {
  await client.query(
    `INSERT INTO calculation.run
       (run_id, pool_id, business_date, rules_version, engine_version,
        correlation_id, maker_id, status, run_kind)
     VALUES($1::uuid, $2, $3::date, $4, 'pms-engine/0.1.0', $5::uuid, $6, 'DRAFT', $7)`,
    [request.runId, request.poolId, request.businessDate, request.rulesVersion,
      request.correlationId, request.requestedBy, request.runKind ?? 'PARALLEL'],
  );
  await client.query(
    `INSERT INTO integration.outbox_event
       (event_id, aggregate_type, aggregate_id, event_type, schema_version,
        correlation_id, payload, occurred_at)
     VALUES(gen_random_uuid(), 'CalculationRun', $1::text, 'pms.calculation.requested.v1', 1,
       $2::uuid, jsonb_build_object(
         'runId', $1::text, 'poolId', $3::text, 'businessDate', $4::text,
         'rulesVersion', $5::text, 'requestedBy', $6::text, 'runKind', $7::text
       ), clock_timestamp())`,
    [request.runId, request.correlationId, request.poolId, request.businessDate,
      request.rulesVersion, request.requestedBy, request.runKind ?? 'PARALLEL'],
  );
}

function isPositiveDecimal(value: string): boolean {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return false;
  const normalized = value.replace('-', '').replace('.', '').replace(/^0+/, '');
  return !value.startsWith('-') && normalized.length > 0;
}
