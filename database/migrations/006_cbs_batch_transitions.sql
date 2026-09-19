BEGIN;

ALTER TABLE integration.cbs_batch ADD COLUMN IF NOT EXISTS state_reason text;

CREATE TABLE IF NOT EXISTS integration.cbs_batch_state_history (
  batch_id uuid NOT NULL REFERENCES integration.cbs_batch(batch_id),
  previous_state text,
  next_state text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (batch_id, changed_at)
);

CREATE OR REPLACE FUNCTION integration.guard_cbs_batch_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = NEW.state THEN RETURN NEW; END IF;
  IF NOT (CASE OLD.state
    WHEN 'RECEIVED' THEN NEW.state IN ('SCANNED', 'QUARANTINED', 'FAILED', 'CANCELLED')
    WHEN 'SCANNED' THEN NEW.state IN ('STAGED', 'QUARANTINED', 'FAILED', 'CANCELLED')
    WHEN 'STAGED' THEN NEW.state IN ('VALIDATED', 'REJECTED', 'PARTIALLY_REJECTED', 'FAILED', 'CANCELLED')
    WHEN 'VALIDATED' THEN NEW.state IN ('APPROVED', 'REJECTED', 'PARTIALLY_REJECTED', 'CANCELLED')
    WHEN 'APPROVED' THEN NEW.state IN ('PUBLISHED', 'FAILED', 'CANCELLED')
    ELSE false
  END) THEN
    RAISE EXCEPTION 'Invalid CBS batch transition: % -> %', OLD.state, NEW.state;
  END IF;
  INSERT INTO integration.cbs_batch_state_history (batch_id, previous_state, next_state, reason)
  VALUES (NEW.batch_id, OLD.state, NEW.state, NEW.state_reason);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cbs_batch_transition_guard ON integration.cbs_batch;
CREATE TRIGGER cbs_batch_transition_guard
BEFORE UPDATE OF state ON integration.cbs_batch
FOR EACH ROW EXECUTE FUNCTION integration.guard_cbs_batch_transition();

COMMIT;
