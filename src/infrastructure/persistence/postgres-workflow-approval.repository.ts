import type { Pool, PoolClient } from 'pg';

import type {
  WorkflowApprovalCommand,
  WorkflowApprovalRepository,
} from '../../modules/closing-workflow/application/perform-workflow-approval.js';

export class PostgresWorkflowApprovalRepository implements WorkflowApprovalRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async transition(command: WorkflowApprovalCommand): Promise<{ state: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const replay = await existingAction(client, command);
      if (replay) {
        await client.query('COMMIT');
        return { state: replay };
      }
      const transition = command.action === 'APPROVE_CLOSING' || command.action === 'REJECT_CLOSING'
        ? await transitionClosing(client, command)
        : await transitionCalculation(client, command);
      const { state, businessDate } = transition;
      await client.query(
        `INSERT INTO workflow.approval_action
           (idempotency_key, resource_type, resource_id, action, actor_id, justification, result_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [command.idempotencyKey,
          command.action === 'APPROVE_CLOSING' || command.action === 'REJECT_CLOSING' ? 'ClosingPeriod' : 'CalculationRun',
          command.resourceId, command.action, command.actorId, command.justification, state],
      );
      await insertAuditIntent(client, command, state, businessDate);
      await client.query('COMMIT');
      return { state };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function insertAuditIntent(
  client: PoolClient,
  command: WorkflowApprovalCommand,
  state: string,
  businessDate: string,
): Promise<void> {
  const resourceType = command.action === 'APPROVE_CLOSING' || command.action === 'REJECT_CLOSING'
    ? 'ClosingPeriod'
    : 'CalculationRun';
  await client.query(
    `INSERT INTO integration.outbox_event (
       event_id, aggregate_type, aggregate_id, event_type, schema_version,
       correlation_id, payload, occurred_at
     ) VALUES (
       gen_random_uuid(), $1, $2, 'pms.audit.workflow-action-recorded.v1', 1,
       $3::uuid, jsonb_strip_nulls(jsonb_build_object(
         'action', $4,
         'actorId', $5,
         'resourceType', $1,
         'resourceId', $2,
         'businessDate', $8,
         'justification', $6,
         'resultState', $7,
         'sessionId', $9
       )), clock_timestamp()
     )`,
    [resourceType, command.resourceId, command.correlationId, command.action,
      command.actorId, command.justification, state, businessDate, command.sessionId ?? null],
  );
}

async function existingAction(client: PoolClient, command: WorkflowApprovalCommand): Promise<string | undefined> {
  const result = await client.query<{
    resource_id: string; action: string; actor_id: string; justification: string; result_state: string;
  }>(
    `SELECT resource_id, action, actor_id, justification, result_state
     FROM workflow.approval_action WHERE idempotency_key = $1`, [command.idempotencyKey],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  if (row.resource_id !== command.resourceId || row.action !== command.action ||
    row.actor_id !== command.actorId || row.justification !== command.justification) {
    throw new Error('Idempotency key was already used for a different workflow action');
  }
  return row.result_state;
}

async function transitionCalculation(
  client: PoolClient,
  command: WorkflowApprovalCommand,
): Promise<{ state: string; businessDate: string }> {
  const result = await client.query<{
    status: string; maker_id: string | null; controller_id: string | null; run_kind: string; business_date: string;
  }>(
    `SELECT status, maker_id, controller_id, run_kind, business_date::text AS business_date FROM calculation.run
     WHERE run_id = $1::uuid FOR UPDATE`, [command.resourceId],
  );
  const run = result.rows[0];
  if (!run) throw new Error('Calculation run not found');
  if (!run.maker_id) throw new Error('Calculation run has no Maker identity');
  if (run.maker_id === command.actorId) throw new Error('Maker cannot control or approve their own calculation');
  if (command.action === 'CONTROL_CALCULATION') {
    if (run.status !== 'CALCULATED') throw new Error(`Calculation cannot be controlled from ${run.status}`);
    await client.query(
      `UPDATE calculation.run SET status = 'CONTROLLED', controller_id = $2,
         controlled_at = clock_timestamp() WHERE run_id = $1::uuid`,
      [command.resourceId, command.actorId],
    );
    return { state: 'CONTROLLED', businessDate: run.business_date };
  }
  if (run.status !== 'CONTROLLED') throw new Error(`Calculation cannot be approved from ${run.status}`);
  if (run.run_kind === 'PRODUCTION') {
    const certification = await client.query<{ certified: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM homologation.opening_balance_certification certificate
       WHERE certificate.status='CERTIFIED' AND (SELECT count(*) FROM homologation.opening_balance_reconciliation line
       WHERE line.certification_id=certificate.certification_id)=4) AS certified`,
    );
    if (!certification.rows[0]?.certified) throw new Error('Production calculation publication blocked: opening balances are not Finance-certified');
  }
  const purification = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM revenue.purification_case purification
     JOIN calculation.run candidate ON candidate.run_id = $1::uuid
     WHERE purification.pool_id = candidate.pool_id AND purification.business_date <= candidate.business_date
       AND purification.status = 'PENDING_DOCUMENTATION'`, [command.resourceId],
  );
  if (Number(purification.rows[0]?.count ?? 0) > 0) throw new Error('Calculation publication blocked by undocumented purification');
  await client.query(
    `UPDATE calculation.run SET status = 'APPROVED', approver_id = $2,
       approved_at = clock_timestamp() WHERE run_id = $1::uuid`,
    [command.resourceId, command.actorId],
  );
  return { state: 'APPROVED', businessDate: run.business_date };
}

async function transitionClosing(
  client: PoolClient,
  command: WorkflowApprovalCommand,
): Promise<{ state: string; businessDate: string }> {
  const result = await client.query<{ state: string; requested_by: string; business_date: string }>(
    `SELECT state, requested_by, business_date::text AS business_date FROM workflow.closing_period
     WHERE closing_id = $1::uuid FOR UPDATE`, [command.resourceId],
  );
  const closing = result.rows[0];
  if (!closing) throw new Error('Closing period not found');
  if (closing.requested_by === command.actorId) throw new Error('Maker cannot control, approve or reject their own closing');
  if (closing.state !== 'CONTROLS_PASSED') throw new Error(`Closing cannot be reviewed from ${closing.state}`);
  if (command.action === 'REJECT_CLOSING') {
    await client.query(
      `UPDATE workflow.closing_period SET state = 'BLOCKED', workflow_status = 'ANOMALY', checker_id = $2
       WHERE closing_id = $1::uuid`, [command.resourceId, command.actorId],
    );
    await client.query(
      `INSERT INTO workflow.closing_rejection(closing_id,rejected_by,comment,idempotency_key)
       VALUES($1::uuid,$2,$3,$4)`, [command.resourceId, command.actorId, command.justification, command.idempotencyKey],
    );
    return { state: 'ANOMALY', businessDate: closing.business_date };
  }
  await client.query(
    `UPDATE workflow.closing_period SET state = 'APPROVED', checker_id = $2,
       approved_at = clock_timestamp() WHERE closing_id = $1::uuid`,
    [command.resourceId, command.actorId],
  );
  return { state: 'APPROVED', businessDate: closing.business_date };
}
