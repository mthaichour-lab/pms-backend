BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Stable currency identity used by foreign keys. Time-dependent attributes live
-- exclusively in currency_version and must always be resolved by business date.
CREATE TABLE IF NOT EXISTS reference.currency (
  currency_code char(3) PRIMARY KEY CHECK (currency_code ~ '^[A-Z]{3}$')
);

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

CREATE OR REPLACE FUNCTION reference.register_currency_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO reference.currency(currency_code) VALUES (NEW.currency_code)
  ON CONFLICT (currency_code) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS currency_version_register_identity ON reference.currency_version;
CREATE TRIGGER currency_version_register_identity
BEFORE INSERT ON reference.currency_version
FOR EACH ROW EXECUTE FUNCTION reference.register_currency_identity();

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
