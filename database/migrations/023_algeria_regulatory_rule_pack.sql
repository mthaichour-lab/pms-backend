BEGIN;

CREATE TABLE IF NOT EXISTS reference.regulatory_rule (
  regulatory_rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code text NOT NULL CHECK (rule_code ~ '^[A-Z][A-Z0-9_.-]{2,63}$'),
  version integer NOT NULL CHECK (version > 0),
  authority text NOT NULL CHECK (authority IN ('BANK_OF_ALGERIA', 'SHARIA_COMMITTEE', 'AAOIFI', 'IFSB')),
  legal_reference text NOT NULL CHECK (length(trim(legal_reference)) >= 3),
  effective_from date NOT NULL,
  effective_to date,
  parameters jsonb NOT NULL CHECK (jsonb_typeof(parameters) = 'object' AND parameters <> '{}'::jsonb),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (rule_code, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS regulatory_rule_one_open_version
  ON reference.regulatory_rule(rule_code) WHERE effective_to IS NULL;

CREATE OR REPLACE FUNCTION reference.prevent_regulatory_rule_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Regulatory rule versions cannot be deleted'; END IF;
  IF NEW.rule_code <> OLD.rule_code OR NEW.version <> OLD.version OR NEW.authority <> OLD.authority
     OR NEW.legal_reference <> OLD.legal_reference OR NEW.effective_from <> OLD.effective_from
     OR NEW.parameters <> OLD.parameters OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Regulatory rule version content is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS regulatory_rule_immutable ON reference.regulatory_rule;
CREATE TRIGGER regulatory_rule_immutable BEFORE UPDATE OR DELETE ON reference.regulatory_rule
FOR EACH ROW EXECUTE FUNCTION reference.prevent_regulatory_rule_mutation();

COMMIT;
