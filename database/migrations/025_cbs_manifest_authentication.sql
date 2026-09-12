BEGIN;

ALTER TABLE integration.cbs_batch DROP CONSTRAINT IF EXISTS cbs_batch_state_check;
ALTER TABLE integration.cbs_batch ADD CONSTRAINT cbs_batch_state_check CHECK (state IN (
  'RECEIVED', 'AUTHENTICATED', 'SCANNED', 'STAGED', 'VALIDATED', 'APPROVED', 'PUBLISHED',
  'QUARANTINED', 'REJECTED', 'PARTIALLY_REJECTED', 'FAILED', 'CANCELLED'
));

CREATE OR REPLACE FUNCTION integration.guard_cbs_batch_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = NEW.state THEN RETURN NEW; END IF;
  IF NOT CASE OLD.state
    WHEN 'RECEIVED' THEN NEW.state IN ('AUTHENTICATED', 'REJECTED', 'FAILED', 'CANCELLED')
    WHEN 'AUTHENTICATED' THEN NEW.state IN ('SCANNED', 'QUARANTINED', 'FAILED', 'CANCELLED')
    WHEN 'SCANNED' THEN NEW.state IN ('STAGED', 'QUARANTINED', 'FAILED', 'CANCELLED')
    WHEN 'STAGED' THEN NEW.state IN ('VALIDATED', 'REJECTED', 'PARTIALLY_REJECTED', 'FAILED', 'CANCELLED')
    WHEN 'VALIDATED' THEN NEW.state IN ('APPROVED', 'REJECTED', 'PARTIALLY_REJECTED', 'CANCELLED')
    WHEN 'APPROVED' THEN NEW.state IN ('PUBLISHED', 'FAILED', 'CANCELLED')
    ELSE false
  END THEN RAISE EXCEPTION 'Invalid CBS batch transition: % -> %', OLD.state, NEW.state; END IF;
  INSERT INTO integration.cbs_batch_state_history (batch_id, previous_state, next_state, reason)
  VALUES (NEW.batch_id, OLD.state, NEW.state, NEW.state_reason);
  RETURN NEW;
END;
$$;

COMMIT;
