BEGIN;

ALTER TABLE integration.cbs_batch
  ADD COLUMN IF NOT EXISTS manifest_row_count integer CHECK (manifest_row_count >= 0),
  ADD COLUMN IF NOT EXISTS manifest_balance_total numeric(30,12);

CREATE TABLE IF NOT EXISTS integration.cbs_data_quality_issue (
  issue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES integration.cbs_batch(batch_id),
  row_number integer,
  control_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('ERROR', 'WARNING')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (batch_id, row_number, control_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cbs_dq_batch_issue
  ON integration.cbs_data_quality_issue (batch_id, control_code)
  WHERE row_number IS NULL;

CREATE OR REPLACE VIEW integration.cbs_data_quality_dashboard AS
SELECT b.batch_id, b.source_code, b.business_date, b.flow_type, b.sequence_number, b.state,
       b.manifest_row_count, b.manifest_balance_total,
       count(i.issue_id) FILTER (WHERE i.severity = 'ERROR')::integer AS error_count,
       count(i.issue_id) FILTER (WHERE i.severity = 'WARNING')::integer AS warning_count,
       max(i.detected_at) AS last_control_at
FROM integration.cbs_batch b LEFT JOIN integration.cbs_data_quality_issue i ON i.batch_id = b.batch_id
GROUP BY b.batch_id;

CREATE OR REPLACE FUNCTION integration.reject_dq_issue_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CBS data-quality issues are append-only'; END; $$;
DROP TRIGGER IF EXISTS cbs_dq_issue_immutable ON integration.cbs_data_quality_issue;
CREATE TRIGGER cbs_dq_issue_immutable BEFORE UPDATE OR DELETE ON integration.cbs_data_quality_issue
FOR EACH ROW EXECUTE FUNCTION integration.reject_dq_issue_mutation();

COMMIT;
