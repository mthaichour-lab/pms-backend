BEGIN;

CREATE TABLE IF NOT EXISTS workflow.exception_case(
  exception_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_type text NOT NULL,source_id text NOT NULL,
  resource_type text NOT NULL,resource_id text NOT NULL,severity text NOT NULL CHECK(severity IN('LOW','MEDIUM','HIGH','CRITICAL')),
  title text NOT NULL CHECK(length(trim(title))>=5),description text NOT NULL CHECK(length(trim(description))>=10),
  status text NOT NULL CHECK(status IN('DETECTED','QUALIFIED','ASSIGNED','IN_PROGRESS','CORRECTED','CONTROLLED','CLOSED','ACCEPTED_RISK')),
  risk_acceptance_reference text,created_by text NOT NULL,idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(source_type,source_id),CHECK(status<>'ACCEPTED_RISK' OR risk_acceptance_reference IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS exception_publication_blocker_idx ON workflow.exception_case(resource_type,resource_id)
WHERE severity='CRITICAL' AND status NOT IN('CLOSED','ACCEPTED_RISK');

CREATE TABLE IF NOT EXISTS workflow.exception_case_history(
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exception_id uuid NOT NULL REFERENCES workflow.exception_case(exception_id),
  previous_status text NOT NULL,resulting_status text NOT NULL,actor_id text NOT NULL,comment text NOT NULL CHECK(length(trim(comment))>=10),
  risk_acceptance_reference text,idempotency_key text NOT NULL UNIQUE,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(resulting_status<>'ACCEPTED_RISK' OR risk_acceptance_reference IS NOT NULL)
);
CREATE OR REPLACE FUNCTION workflow.guard_exception_transition()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
  IF NOT CASE NEW.previous_status WHEN'DETECTED'THEN NEW.resulting_status='QUALIFIED' WHEN'QUALIFIED'THEN NEW.resulting_status='ASSIGNED'
    WHEN'ASSIGNED'THEN NEW.resulting_status='IN_PROGRESS' WHEN'IN_PROGRESS'THEN NEW.resulting_status='CORRECTED'
    WHEN'CORRECTED'THEN NEW.resulting_status='CONTROLLED' WHEN'CONTROLLED'THEN NEW.resulting_status IN('CLOSED','IN_PROGRESS','ACCEPTED_RISK') ELSE false END
  THEN RAISE EXCEPTION 'Invalid exception lifecycle transition';END IF;RETURN NEW;END;$$;
CREATE TRIGGER exception_transition_guard BEFORE INSERT ON workflow.exception_case_history FOR EACH ROW EXECUTE FUNCTION workflow.guard_exception_transition();
CREATE OR REPLACE FUNCTION workflow.reject_exception_history_mutation()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Exception case history is append-only';END;$$;
CREATE TRIGGER exception_history_immutable BEFORE UPDATE OR DELETE ON workflow.exception_case_history FOR EACH ROW EXECUTE FUNCTION workflow.reject_exception_history_mutation();

CREATE OR REPLACE FUNCTION workflow.assert_no_blocking_exception(p_resource_type text,p_resource_id text)RETURNS void LANGUAGE plpgsql AS $$BEGIN
  IF EXISTS(SELECT 1 FROM workflow.exception_case WHERE resource_type=p_resource_type AND resource_id=p_resource_id AND severity='CRITICAL' AND status NOT IN('CLOSED','ACCEPTED_RISK'))
  THEN RAISE EXCEPTION 'Publication blocked by unresolved critical exception';END IF;END;$$;
CREATE OR REPLACE FUNCTION workflow.guard_critical_exception_publication()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
  IF TG_TABLE_SCHEMA='calculation' AND NEW.status IN('POSTED','ARCHIVED') AND OLD.status IS DISTINCT FROM NEW.status THEN PERFORM workflow.assert_no_blocking_exception('CalculationRun',NEW.run_id::text);
  ELSIF TG_TABLE_SCHEMA='integration' AND NEW.state='PUBLISHED' AND OLD.state IS DISTINCT FROM NEW.state THEN PERFORM workflow.assert_no_blocking_exception('CbsBatch',NEW.batch_id::text);
  ELSIF TG_TABLE_SCHEMA='workflow' AND NEW.workflow_status='CLOSED' AND OLD.workflow_status IS DISTINCT FROM NEW.workflow_status THEN PERFORM workflow.assert_no_blocking_exception('ClosingPeriod',NEW.closing_id::text);END IF;
  RETURN NEW;END;$$;
CREATE TRIGGER calculation_exception_publication_guard BEFORE UPDATE OF status ON calculation.run FOR EACH ROW EXECUTE FUNCTION workflow.guard_critical_exception_publication();
CREATE TRIGGER cbs_exception_publication_guard BEFORE UPDATE OF state ON integration.cbs_batch FOR EACH ROW EXECUTE FUNCTION workflow.guard_critical_exception_publication();
CREATE TRIGGER closing_exception_publication_guard BEFORE UPDATE OF workflow_status ON workflow.closing_period FOR EACH ROW EXECUTE FUNCTION workflow.guard_critical_exception_publication();

COMMIT;
