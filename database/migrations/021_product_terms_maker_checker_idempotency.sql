BEGIN;

ALTER TABLE product.terms_version
  ADD COLUMN IF NOT EXISTS created_by text;

UPDATE product.terms_version SET created_by = 'migration' WHERE created_by IS NULL;
ALTER TABLE product.terms_version ALTER COLUMN created_by SET NOT NULL;

-- Rebuild the immutability guard after adding created_by: a retirement may only
-- change status and must not be used to rewrite maker evidence.
CREATE OR REPLACE FUNCTION product.guard_published_terms()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Product terms cannot be deleted'; END IF;
  IF OLD.status IN ('PUBLISHED', 'RETIRED') AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    IF NOT (OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED'
      AND NEW.terms_version_id = OLD.terms_version_id AND NEW.product_id = OLD.product_id
      AND NEW.version = OLD.version AND NEW.effective_from = OLD.effective_from
      AND NEW.effective_to IS NOT DISTINCT FROM OLD.effective_to
      AND NEW.investor_nisba = OLD.investor_nisba AND NEW.bank_nisba = OLD.bank_nisba
      AND NEW.indicative_target_rate IS NOT DISTINCT FROM OLD.indicative_target_rate
      AND NEW.simulation_checksum_sha256 = OLD.simulation_checksum_sha256
      AND NEW.retroactive_approval_id IS NOT DISTINCT FROM OLD.retroactive_approval_id
      AND NEW.created_at = OLD.created_at AND NEW.published_at = OLD.published_at
      AND NEW.created_by = OLD.created_by) THEN
      RAISE EXCEPTION 'Published product terms are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS product.terms_command_idempotency (
  idempotency_key text PRIMARY KEY CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  operation text NOT NULL CHECK (operation IN ('CREATE_TERMS', 'PUBLISH_TERMS')),
  terms_version_id uuid NOT NULL REFERENCES product.terms_version(terms_version_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE product.terms_command_idempotency IS
  'Commands are serialized with pg_advisory_xact_lock(hashtextextended(idempotency_key, 0)) before mutation.';

CREATE OR REPLACE FUNCTION product.prevent_terms_command_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Product terms command idempotency records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS terms_command_idempotency_immutable ON product.terms_command_idempotency;
CREATE TRIGGER terms_command_idempotency_immutable BEFORE UPDATE OR DELETE ON product.terms_command_idempotency
FOR EACH ROW EXECUTE FUNCTION product.prevent_terms_command_mutation();

COMMIT;
