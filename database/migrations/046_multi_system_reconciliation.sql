BEGIN;

ALTER TABLE accounting.reconciliation ADD COLUMN IF NOT EXISTS reconciliation_type text NOT NULL DEFAULT 'SUBLEDGER_GL'
  CHECK(reconciliation_type IN('ACCOUNTS_CBS','ASSETS_FINANCING','REVENUE_GL','SUBLEDGER_GL','CALCULATED_POSTED_PROFIT','PER_IRR_ACCOUNTING','PURIFICATION_DISBURSEMENT'));

CREATE TABLE IF NOT EXISTS accounting.reconciliation_control(
  reconciliation_type text PRIMARY KEY,
  frequency text NOT NULL CHECK(frequency IN('DAILY','MONTHLY','ON_CLOSING')),
  cutoff_time time NOT NULL,
  enabled boolean NOT NULL DEFAULT true
);
INSERT INTO accounting.reconciliation_control(reconciliation_type,frequency,cutoff_time) VALUES
('ACCOUNTS_CBS','DAILY','20:00'),('ASSETS_FINANCING','DAILY','20:00'),('REVENUE_GL','DAILY','21:00'),
('SUBLEDGER_GL','DAILY','21:00'),('CALCULATED_POSTED_PROFIT','ON_CLOSING','22:00'),
('PER_IRR_ACCOUNTING','ON_CLOSING','22:00'),('PURIFICATION_DISBURSEMENT','ON_CLOSING','22:00')
ON CONFLICT(reconciliation_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS accounting.reconciliation_discrepancy(
  discrepancy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES accounting.reconciliation(reconciliation_id),
  amount numeric(38,12) NOT NULL,
  currency_code char(3) NOT NULL REFERENCES reference.currency(currency_code),
  severity text NOT NULL CHECK(severity IN('LOW','MEDIUM','HIGH','CRITICAL')),
  owner_id text NOT NULL,
  cause text NOT NULL CHECK(length(trim(cause))>=5),
  corrective_action text NOT NULL CHECK(length(trim(corrective_action))>=5),
  status text NOT NULL CHECK(status IN('DETECTED','QUALIFIED','ASSIGNED','IN_PROGRESS','CORRECTED','CONTROLLED','CLOSED','ACCEPTED_RISK')),
  resolution_due_at timestamptz NOT NULL,
  escalation_level smallint NOT NULL DEFAULT 1 CHECK(escalation_level BETWEEN 1 AND 5),
  risk_acceptance_reference text,
  detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  CHECK(status<>'ACCEPTED_RISK' OR risk_acceptance_reference IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_one_discrepancy ON accounting.reconciliation_discrepancy(reconciliation_id);
CREATE INDEX IF NOT EXISTS reconciliation_discrepancy_overdue_idx ON accounting.reconciliation_discrepancy(resolution_due_at)
WHERE status NOT IN('CLOSED','ACCEPTED_RISK');

CREATE TABLE IF NOT EXISTS accounting.reconciliation_discrepancy_history(
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),discrepancy_id uuid NOT NULL REFERENCES accounting.reconciliation_discrepancy(discrepancy_id),
  previous_status text NOT NULL,resulting_status text NOT NULL,actor_id text NOT NULL,evidence jsonb NOT NULL,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION accounting.reject_discrepancy_history_mutation()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Reconciliation discrepancy history is append-only';END;$$;
CREATE TRIGGER reconciliation_discrepancy_history_immutable BEFORE UPDATE OR DELETE ON accounting.reconciliation_discrepancy_history FOR EACH ROW EXECUTE FUNCTION accounting.reject_discrepancy_history_mutation();

CREATE OR REPLACE FUNCTION accounting.escalate_overdue_discrepancies(p_now timestamptz)RETURNS integer LANGUAGE plpgsql AS $$DECLARE affected integer;BEGIN
  WITH updated AS(UPDATE accounting.reconciliation_discrepancy SET escalation_level=LEAST(escalation_level+1,5),resolution_due_at=resolution_due_at+interval '4 hours'
    WHERE resolution_due_at<=p_now AND status NOT IN('CLOSED','ACCEPTED_RISK') AND escalation_level<5 RETURNING discrepancy_id,reconciliation_id,escalation_level),
  emitted AS(INSERT INTO integration.outbox_event(event_id,aggregate_type,aggregate_id,event_type,schema_version,correlation_id,payload,occurred_at)
    SELECT gen_random_uuid(),'ReconciliationDiscrepancy',discrepancy_id::text,'ReconciliationDiscrepancyEscalated.v1',1,discrepancy_id,
      jsonb_build_object('discrepancyId',discrepancy_id,'reconciliationId',reconciliation_id,'delegationLevel',escalation_level),p_now FROM updated RETURNING 1)
  SELECT count(*) INTO affected FROM emitted;RETURN affected;END;$$;

COMMIT;
