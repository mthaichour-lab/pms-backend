BEGIN;

ALTER TABLE audit.event
  ADD COLUMN IF NOT EXISTS signing_key_id text NOT NULL,
  ADD COLUMN IF NOT EXISTS signature_base64 text NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS audit_event_previous_hash_unique
  ON audit.event (previous_hash)
  WHERE previous_hash IS NOT NULL;

COMMIT;
