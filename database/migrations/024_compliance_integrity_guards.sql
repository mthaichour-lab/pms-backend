BEGIN;

-- Arbitration decisions may only compare references already associated with
-- the same product. The unique index is the target of the composite FKs.
CREATE UNIQUE INDEX IF NOT EXISTS product_reference_product_reference_uidx
  ON product.product_reference(product_id, reference_id);

ALTER TABLE product.compliance_arbitration
  DROP CONSTRAINT IF EXISTS compliance_arbitration_selected_association_fk,
  DROP CONSTRAINT IF EXISTS compliance_arbitration_rejected_association_fk;

ALTER TABLE product.compliance_arbitration
  ADD CONSTRAINT compliance_arbitration_selected_association_fk
    FOREIGN KEY (product_id, selected_reference_id)
    REFERENCES product.product_reference(product_id, reference_id),
  ADD CONSTRAINT compliance_arbitration_rejected_association_fk
    FOREIGN KEY (product_id, rejected_reference_id)
    REFERENCES product.product_reference(product_id, reference_id);

CREATE OR REPLACE FUNCTION product.enforce_compliance_arbitration_priority()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  selected_priority integer;
  rejected_priority integer;
BEGIN
  SELECT CASE source WHEN 'BA' THEN 4 WHEN 'SHARIA_COMMITTEE' THEN 3 WHEN 'AAOIFI' THEN 2 WHEN 'IFSB' THEN 1 END
    INTO selected_priority FROM product.compliance_reference WHERE reference_id = NEW.selected_reference_id;
  SELECT CASE source WHEN 'BA' THEN 4 WHEN 'SHARIA_COMMITTEE' THEN 3 WHEN 'AAOIFI' THEN 2 WHEN 'IFSB' THEN 1 END
    INTO rejected_priority FROM product.compliance_reference WHERE reference_id = NEW.rejected_reference_id;
  IF selected_priority < rejected_priority THEN
    RAISE EXCEPTION 'Arbitration cannot override normative compliance priority';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compliance_arbitration_priority ON product.compliance_arbitration;
CREATE TRIGGER compliance_arbitration_priority
BEFORE INSERT ON product.compliance_arbitration
FOR EACH ROW EXECUTE FUNCTION product.enforce_compliance_arbitration_priority();

-- A rule code must never resolve to two versions on the same business date.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE reference.regulatory_rule
  DROP CONSTRAINT IF EXISTS regulatory_rule_effective_period_excl;
ALTER TABLE reference.regulatory_rule
  ADD CONSTRAINT regulatory_rule_effective_period_excl
  EXCLUDE USING gist (
    rule_code WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  );

COMMIT;
