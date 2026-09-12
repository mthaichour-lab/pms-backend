BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS product.terms_version (
  terms_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product.investment_product(product_id),
  version integer NOT NULL CHECK (version > 0),
  effective_from date NOT NULL,
  effective_to date,
  investor_nisba numeric(9,6) NOT NULL CHECK (investor_nisba BETWEEN 0 AND 100),
  bank_nisba numeric(9,6) NOT NULL CHECK (bank_nisba BETWEEN 0 AND 100),
  indicative_target_rate numeric(9,6) CHECK (indicative_target_rate BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  simulation_checksum_sha256 text CHECK (simulation_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  retroactive_approval_id text REFERENCES workflow.approval_action(idempotency_key),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (investor_nisba + bank_nisba = 100),
  CHECK (status = 'DRAFT' OR (simulation_checksum_sha256 IS NOT NULL AND published_at IS NOT NULL)),
  UNIQUE (product_id, version)
);

ALTER TABLE product.terms_version DROP CONSTRAINT IF EXISTS product_terms_no_published_overlap;
ALTER TABLE product.terms_version ADD CONSTRAINT product_terms_no_published_overlap
  EXCLUDE USING gist (product_id WITH =, daterange(effective_from, COALESCE(effective_to + 1, 'infinity'::date), '[)') WITH &&)
  WHERE (status = 'PUBLISHED');

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
      AND NEW.created_at = OLD.created_at AND NEW.published_at = OLD.published_at) THEN
      RAISE EXCEPTION 'Published product terms are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_terms_immutable ON product.terms_version;
CREATE TRIGGER product_terms_immutable BEFORE UPDATE OR DELETE ON product.terms_version
FOR EACH ROW EXECUTE FUNCTION product.guard_published_terms();

COMMIT;
