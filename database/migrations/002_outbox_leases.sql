BEGIN;

ALTER TABLE integration.outbox_event
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

CREATE INDEX IF NOT EXISTS outbox_claimable_idx
  ON integration.outbox_event (available_at, created_at)
  WHERE published_at IS NULL;

COMMIT;
