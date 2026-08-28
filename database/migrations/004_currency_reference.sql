BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS reference.currency_version (
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  fraction_digits smallint NOT NULL CHECK (fraction_digits BETWEEN 0 AND 6),
  valid_from date NOT NULL,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by text NOT NULL,
  PRIMARY KEY (currency_code, valid_from),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'currency_version_no_overlap'
      AND conrelid = 'reference.currency_version'::regclass
  ) THEN
    ALTER TABLE reference.currency_version ADD CONSTRAINT currency_version_no_overlap
      EXCLUDE USING gist (
        currency_code WITH =,
        daterange(valid_from, valid_until, '[)') WITH &&
      );
  END IF;
END;
$$;

COMMIT;
