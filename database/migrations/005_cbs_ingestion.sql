BEGIN;

CREATE TABLE IF NOT EXISTS integration.cbs_batch (
  batch_id uuid PRIMARY KEY,
  source_code text NOT NULL,
  business_date date NOT NULL,
  flow_type text NOT NULL,
  sequence_number bigint NOT NULL CHECK (sequence_number >= 0),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  object_key text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'RECEIVED', 'SCANNED', 'STAGED', 'VALIDATED', 'APPROVED', 'PUBLISHED',
    'QUARANTINED', 'REJECTED', 'PARTIALLY_REJECTED', 'FAILED', 'CANCELLED'
  )),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (source_code, business_date, flow_type, sequence_number)
);

CREATE INDEX IF NOT EXISTS cbs_batch_pending_idx
  ON integration.cbs_batch (business_date, received_at)
  WHERE state NOT IN ('PUBLISHED', 'QUARANTINED', 'REJECTED', 'FAILED', 'CANCELLED');

COMMIT;
