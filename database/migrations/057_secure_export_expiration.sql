BEGIN;

ALTER TABLE reporting.secure_export
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Migration 052 deliberately freezes GENERATED rows. Temporarily suspend that
-- trigger while backfilling the new security metadata; the surrounding
-- transaction guarantees that a failed backfill cannot leave it disabled.
ALTER TABLE reporting.secure_export
  DISABLE TRIGGER generated_secure_export_immutable;

UPDATE reporting.secure_export
SET expires_at = created_at + interval '24 hours'
WHERE expires_at IS NULL;

ALTER TABLE reporting.secure_export
  ENABLE TRIGGER generated_secure_export_immutable;

-- The original BEFORE DELETE trigger returned NEW for non-generated rows. NEW is
-- null during DELETE and therefore silently cancelled legitimate cleanup. Keep
-- generated evidence immutable while returning OLD for permitted deletions.
CREATE OR REPLACE FUNCTION reporting.guard_generated_secure_export()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'GENERATED' THEN
    RAISE EXCEPTION 'Generated secure export is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE reporting.secure_export
  ALTER COLUMN expires_at SET DEFAULT (clock_timestamp() + interval '24 hours'),
  ALTER COLUMN expires_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'secure_export_expiration_after_creation'
      AND conrelid = 'reporting.secure_export'::regclass
  ) THEN
    ALTER TABLE reporting.secure_export
      ADD CONSTRAINT secure_export_expiration_after_creation
      CHECK (expires_at > created_at);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS secure_export_expiration_idx
  ON reporting.secure_export (expires_at)
  WHERE status <> 'GENERATED';

COMMIT;
