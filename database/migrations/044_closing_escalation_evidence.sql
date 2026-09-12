BEGIN;

CREATE TABLE IF NOT EXISTS workflow.closing_task (
  task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES workflow.closing_period(closing_id),
  step text NOT NULL,
  assigned_to text NOT NULL,
  delegation_level smallint NOT NULL DEFAULT 1 CHECK (delegation_level BETWEEN 1 AND 5),
  due_at timestamptz NOT NULL,
  escalation_interval interval NOT NULL DEFAULT interval '4 hours' CHECK (escalation_interval > interval '0'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','ESCALATED')),
  completed_at timestamptz,
  UNIQUE (closing_id, step)
);

CREATE INDEX IF NOT EXISTS closing_task_overdue_idx
  ON workflow.closing_task(due_at) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS workflow.closing_task_escalation (
  escalation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES workflow.closing_task(task_id),
  from_level smallint NOT NULL,
  to_level smallint NOT NULL CHECK (to_level > from_level),
  occurred_at timestamptz NOT NULL,
  UNIQUE (task_id, to_level)
);

CREATE OR REPLACE FUNCTION workflow.escalate_overdue_closing_tasks(p_now timestamptz)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE escalated_count integer;
BEGIN
  WITH due AS (
    SELECT task_id, closing_id, delegation_level, due_at, escalation_interval
    FROM workflow.closing_task
    WHERE status = 'PENDING' AND due_at <= p_now AND delegation_level < 5
    FOR UPDATE SKIP LOCKED
  ), recorded AS (
    INSERT INTO workflow.closing_task_escalation(task_id, from_level, to_level, occurred_at)
    SELECT task_id, delegation_level, delegation_level + 1, p_now FROM due
    ON CONFLICT (task_id, to_level) DO NOTHING
    RETURNING task_id, to_level, escalation_id
  ), updated AS (
    UPDATE workflow.closing_task task
    SET delegation_level = recorded.to_level,
        due_at = task.due_at + task.escalation_interval,
        status = CASE WHEN recorded.to_level = 5 THEN 'ESCALATED' ELSE 'PENDING' END
    FROM recorded WHERE task.task_id = recorded.task_id
    RETURNING task.task_id, task.closing_id, recorded.to_level, recorded.escalation_id
  ), emitted AS (
    INSERT INTO integration.outbox_event(event_id, aggregate_type, aggregate_id, event_type, schema_version, correlation_id, payload, occurred_at)
    SELECT gen_random_uuid(), 'ClosingTask', task_id::text, 'ClosingTaskEscalated.v1', 1,
           escalation_id, jsonb_build_object('taskId',task_id,'closingId',closing_id,'delegationLevel',to_level), p_now
    FROM updated RETURNING 1
  ) SELECT count(*) INTO escalated_count FROM emitted;
  RETURN escalated_count;
END;
$$;

CREATE TABLE IF NOT EXISTS workflow.closing_evidence_package (
  evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL UNIQUE REFERENCES workflow.closing_period(closing_id),
  manifest jsonb NOT NULL,
  accepted_risks jsonb NOT NULL,
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  generated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION workflow.generate_closing_evidence_package()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE evidence_manifest jsonb; accepted jsonb; checksum text; evidence_uuid uuid;
BEGIN
  IF NEW.workflow_status = 'CLOSED' AND OLD.workflow_status IS DISTINCT FROM 'CLOSED' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'stepEventId', event_id, 'step', resulting_step, 'actorId', actor_id,
      'occurredAt', occurred_at, 'evidence', evidence) ORDER BY step_number), '[]'::jsonb),
      COALESCE(jsonb_agg(evidence->'acceptedRiskReferences') FILTER (WHERE jsonb_array_length(COALESCE(evidence->'acceptedRiskReferences','[]'::jsonb)) > 0), '[]'::jsonb)
    INTO evidence_manifest, accepted
    FROM workflow.closing_step_event WHERE closing_id = NEW.closing_id;
    evidence_manifest := jsonb_build_object(
      'formatVersion', 1, 'closingId', NEW.closing_id, 'generatedAt', clock_timestamp(),
      'stepEvents', evidence_manifest,
      'approvalActions', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY occurred_at) FROM workflow.approval_action a WHERE resource_type='ClosingPeriod' AND resource_id=NEW.closing_id::text),'[]'::jsonb),
      'rejections', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY occurred_at) FROM workflow.closing_rejection r WHERE closing_id=NEW.closing_id),'[]'::jsonb),
      'acceptedRisks', accepted);
    checksum := encode(digest(convert_to(evidence_manifest::text, 'UTF8'), 'sha256'), 'hex');
    INSERT INTO workflow.closing_evidence_package(closing_id, manifest, accepted_risks, checksum_sha256)
    VALUES(NEW.closing_id, evidence_manifest, accepted, checksum) RETURNING evidence_id INTO evidence_uuid;
    INSERT INTO integration.outbox_event(event_id, aggregate_type, aggregate_id, event_type, schema_version, correlation_id, payload, occurred_at)
    VALUES(gen_random_uuid(), 'ClosingPeriod', NEW.closing_id::text, 'ClosingEvidencePackageGenerated.v1', 1,
      evidence_uuid, jsonb_build_object('closingId',NEW.closing_id,'evidenceId',evidence_uuid,'checksumSha256',checksum,'acceptedRisks',accepted), clock_timestamp());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS closing_evidence_on_close ON workflow.closing_period;
CREATE TRIGGER closing_evidence_on_close AFTER UPDATE OF workflow_status ON workflow.closing_period
FOR EACH ROW EXECUTE FUNCTION workflow.generate_closing_evidence_package();

CREATE OR REPLACE FUNCTION workflow.reject_closing_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Closing evidence package is immutable';END;$$;
DROP TRIGGER IF EXISTS closing_evidence_immutable ON workflow.closing_evidence_package;
CREATE TRIGGER closing_evidence_immutable BEFORE UPDATE OR DELETE ON workflow.closing_evidence_package
FOR EACH ROW EXECUTE FUNCTION workflow.reject_closing_evidence_mutation();

COMMIT;
