BEGIN;

CREATE TABLE IF NOT EXISTS workflow.closing_period (
  closing_id uuid PRIMARY KEY,
  business_date date NOT NULL UNIQUE,
  requested_by text NOT NULL,
  correlation_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN (
    'REQUESTED', 'CONTROLS_PASSED', 'BLOCKED', 'APPROVED', 'CLOSED', 'FAILED'
  )),
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_checksum_sha256 text CHECK (input_checksum_sha256 IS NULL OR input_checksum_sha256 ~ '^[a-f0-9]{64}$'),
  checker_id text,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  controlled_at timestamptz,
  approved_at timestamptz,
  closed_at timestamptz,
  CHECK (checker_id IS NULL OR checker_id <> requested_by)
);

COMMIT;
