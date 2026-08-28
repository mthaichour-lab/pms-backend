BEGIN;

ALTER TABLE integration.inbox_message
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0
    CHECK (processing_attempts >= 0);

UPDATE integration.inbox_message
SET processing_started_at = received_at, processing_attempts = 1
WHERE processed_at IS NULL AND processing_started_at IS NULL;

COMMIT;
