BEGIN;

CREATE SCHEMA IF NOT EXISTS product;

CREATE TABLE IF NOT EXISTS product.investment_product (
  product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL UNIQUE CHECK (product_code ~ '^[A-Z0-9_-]{2,32}$'),
  product_name text NOT NULL CHECK (length(trim(product_name)) >= 3),
  investor_nisba numeric(9,6) NOT NULL CHECK (investor_nisba BETWEEN 0 AND 100),
  bank_nisba numeric(9,6) NOT NULL CHECK (bank_nisba BETWEEN 0 AND 100),
  sharia_reference text,
  validated_by text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'PUBLISHED', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (status = 'DRAFT' OR length(trim(validated_by)) > 0),
  CHECK (status NOT IN ('PUBLISHED', 'SUSPENDED', 'CLOSED') OR
    (investor_nisba + bank_nisba = 100 AND length(trim(sharia_reference)) > 0))
);

CREATE TABLE IF NOT EXISTS product.product_transition (
  transition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product.investment_product(product_id),
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_id text NOT NULL CHECK (length(trim(actor_id)) > 0),
  justification text NOT NULL CHECK (length(trim(justification)) >= 10),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION product.prevent_transition_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Product transition history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS product_transition_immutable ON product.product_transition;
CREATE TRIGGER product_transition_immutable BEFORE UPDATE OR DELETE ON product.product_transition
FOR EACH ROW EXECUTE FUNCTION product.prevent_transition_mutation();

COMMIT;
