BEGIN;

CREATE TABLE IF NOT EXISTS product.compliance_reference (
  reference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('BA', 'SHARIA_COMMITTEE', 'AAOIFI', 'IFSB')),
  reference_code text NOT NULL,
  version text NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) >= 3),
  effective_from date NOT NULL,
  effective_to date,
  created_by text NOT NULL CHECK (length(trim(created_by)) > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (source, reference_code, version),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS product.product_reference (
  product_id uuid NOT NULL REFERENCES product.investment_product(product_id),
  reference_id uuid NOT NULL REFERENCES product.compliance_reference(reference_id),
  kind text NOT NULL CHECK (kind IN ('CONTRACTUAL_DOCUMENT', 'REGULATORY_DOCUMENT', 'SHARIA_DOCUMENT', 'ACCOUNTING_SCHEMA')),
  associated_by text NOT NULL CHECK (length(trim(associated_by)) > 0),
  associated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (product_id, reference_id, kind)
);

CREATE TABLE IF NOT EXISTS product.compliance_arbitration (
  arbitration_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product.investment_product(product_id),
  selected_reference_id uuid NOT NULL REFERENCES product.compliance_reference(reference_id),
  rejected_reference_id uuid NOT NULL REFERENCES product.compliance_reference(reference_id),
  rationale text NOT NULL CHECK (length(trim(rationale)) >= 20),
  decided_by text NOT NULL CHECK (length(trim(decided_by)) > 0),
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (selected_reference_id <> rejected_reference_id)
);

CREATE OR REPLACE FUNCTION product.prevent_compliance_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Product compliance reference history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS compliance_reference_immutable ON product.compliance_reference;
CREATE TRIGGER compliance_reference_immutable BEFORE UPDATE OR DELETE ON product.compliance_reference
FOR EACH ROW EXECUTE FUNCTION product.prevent_compliance_history_mutation();
DROP TRIGGER IF EXISTS product_reference_immutable ON product.product_reference;
CREATE TRIGGER product_reference_immutable BEFORE UPDATE OR DELETE ON product.product_reference
FOR EACH ROW EXECUTE FUNCTION product.prevent_compliance_history_mutation();
DROP TRIGGER IF EXISTS compliance_arbitration_immutable ON product.compliance_arbitration;
CREATE TRIGGER compliance_arbitration_immutable BEFORE UPDATE OR DELETE ON product.compliance_arbitration
FOR EACH ROW EXECUTE FUNCTION product.prevent_compliance_history_mutation();

COMMIT;
