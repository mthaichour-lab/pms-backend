BEGIN;

ALTER TABLE calculation.run
  ADD COLUMN IF NOT EXISTS maker_id text,
  ADD COLUMN IF NOT EXISTS controller_id text,
  ADD COLUMN IF NOT EXISTS approver_id text,
  ADD COLUMN IF NOT EXISTS controlled_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS workflow.approval_action (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  action text NOT NULL,
  actor_id text NOT NULL,
  justification text NOT NULL CHECK (length(trim(justification)) >= 10),
  result_state text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (resource_type, resource_id, action, actor_id)
);

CREATE OR REPLACE FUNCTION workflow.reject_approval_action_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'workflow.approval_action is append-only';
END;
$$;

DROP TRIGGER IF EXISTS approval_action_no_mutation ON workflow.approval_action;
CREATE TRIGGER approval_action_no_mutation
BEFORE UPDATE OR DELETE ON workflow.approval_action
FOR EACH ROW EXECUTE FUNCTION workflow.reject_approval_action_mutation();

COMMIT;
