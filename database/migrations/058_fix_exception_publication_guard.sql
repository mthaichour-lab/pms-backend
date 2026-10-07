BEGIN;

-- The guard is shared by calculation, CBS and closing tables.  PL/pgSQL binds
-- NEW to the concrete trigger row type, so directly reading NEW.state fails
-- when the trigger is fired for calculation.run (which has status, not state).
-- Reading the common attributes through JSON keeps the guard polymorphic.
CREATE OR REPLACE FUNCTION workflow.guard_critical_exception_publication()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb := to_jsonb(OLD);
BEGIN
  IF TG_TABLE_SCHEMA = 'calculation'
     AND new_row->>'status' IN ('POSTED', 'ARCHIVED')
     AND old_row->>'status' IS DISTINCT FROM new_row->>'status' THEN
    PERFORM workflow.assert_no_blocking_exception('CalculationRun', new_row->>'run_id');
  ELSIF TG_TABLE_SCHEMA = 'integration'
     AND new_row->>'state' = 'PUBLISHED'
     AND old_row->>'state' IS DISTINCT FROM new_row->>'state' THEN
    PERFORM workflow.assert_no_blocking_exception('CbsBatch', new_row->>'batch_id');
  ELSIF TG_TABLE_SCHEMA = 'workflow'
     AND new_row->>'workflow_status' = 'CLOSED'
     AND old_row->>'workflow_status' IS DISTINCT FROM new_row->>'workflow_status' THEN
    PERFORM workflow.assert_no_blocking_exception('ClosingPeriod', new_row->>'closing_id');
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
