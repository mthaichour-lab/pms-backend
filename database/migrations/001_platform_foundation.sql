BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS iam_ref;
CREATE SCHEMA IF NOT EXISTS reference;
CREATE SCHEMA IF NOT EXISTS customer;
CREATE SCHEMA IF NOT EXISTS investment;
CREATE SCHEMA IF NOT EXISTS pooling;
CREATE SCHEMA IF NOT EXISTS calculation;
CREATE SCHEMA IF NOT EXISTS risk;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SCHEMA IF NOT EXISTS compliance;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS document;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS iam_ref.access_grant (
  grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id text NOT NULL,
  manager_id text NOT NULL,
  grant_kind text NOT NULL CHECK (grant_kind IN ('ENTITLEMENT', 'DELEGATION')),
  role_code text NOT NULL,
  legal_entity_ids text[] NOT NULL DEFAULT '{}',
  branch_ids text[] NOT NULL DEFAULT '{}',
  pool_ids text[] NOT NULL DEFAULT '{}',
  delegation_level integer NOT NULL DEFAULT 0 CHECK (delegation_level >= 0),
  maximum_amount numeric(30, 12) NOT NULL DEFAULT 0 CHECK (maximum_amount >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_reviewed_at timestamptz,
  review_interval_days integer NOT NULL CHECK (review_interval_days > 0),
  revoked_at timestamptz,
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS access_grant_subject_idx
  ON iam_ref.access_grant (subject_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS access_grant_review_idx
  ON iam_ref.access_grant (
    (COALESCE(last_reviewed_at, granted_at) + make_interval(days => review_interval_days))
  )
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS integration.outbox_event (
  event_id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_error text
);

CREATE INDEX IF NOT EXISTS outbox_pending_idx
  ON integration.outbox_event (available_at, created_at)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS integration.inbox_message (
  consumer_name text NOT NULL,
  message_id uuid NOT NULL,
  event_type text NOT NULL,
  correlation_id uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz,
  result_checksum text,
  PRIMARY KEY (consumer_name, message_id)
);

CREATE TABLE IF NOT EXISTS document.document_reference (
  document_reference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paperless_document_id bigint NOT NULL UNIQUE,
  business_type text NOT NULL,
  business_id text NOT NULL,
  classification text NOT NULL,
  original_filename text NOT NULL,
  media_type text NOT NULL,
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  worm_object_key text,
  worm_manifest_checksum text CHECK (
    worm_manifest_checksum IS NULL OR worm_manifest_checksum ~ '^[a-f0-9]{64}$'
  ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by text NOT NULL,
  UNIQUE (business_type, business_id, checksum_sha256)
);

CREATE TABLE IF NOT EXISTS audit.event (
  audit_event_id uuid PRIMARY KEY,
  previous_hash text CHECK (previous_hash IS NULL OR previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash text NOT NULL UNIQUE CHECK (event_hash ~ '^[a-f0-9]{64}$'),
  correlation_id uuid NOT NULL,
  actor_id text NOT NULL,
  technical_identity text NOT NULL,
  session_id text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILURE')),
  business_date date NOT NULL,
  occurred_at timestamptz NOT NULL,
  source_application text NOT NULL,
  source_address inet,
  justification text,
  run_id uuid,
  batch_id uuid,
  document_reference_id uuid REFERENCES document.document_reference(document_reference_id),
  authorized_changes jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION audit.reject_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit.event is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_event_no_update ON audit.event;
CREATE TRIGGER audit_event_no_update
BEFORE UPDATE OR DELETE ON audit.event
FOR EACH ROW EXECUTE FUNCTION audit.reject_event_mutation();

COMMIT;
