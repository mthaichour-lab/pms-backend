BEGIN;

CREATE TABLE IF NOT EXISTS document.archive_request (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_object_key text NOT NULL,
  business_type text NOT NULL,
  business_id text NOT NULL,
  classification text NOT NULL,
  evidentiary boolean NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','ARCHIVED')),
  requested_by text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  checksum_sha256 text CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  paperless_document_id bigint,
  worm_object_key text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz,
  CHECK ((status = 'QUEUED' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL AND checksum_sha256 IS NOT NULL AND paperless_document_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS document_archive_request_business_idx ON document.archive_request(business_type,business_id,created_at DESC);

COMMIT;
