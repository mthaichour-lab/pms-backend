BEGIN;

CREATE TABLE IF NOT EXISTS risk.dcr_calculation (
  dcr_calculation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id text NOT NULL REFERENCES pooling.pool(pool_id),
  business_date date NOT NULL,
  currency_code char(3) NOT NULL REFERENCES reference.currency(currency_code),
  capital_duration_amount numeric(38, 12) NOT NULL CHECK (capital_duration_amount >= 0),
  risk_weighted_duration_amount numeric(38, 12) NOT NULL CHECK (risk_weighted_duration_amount > 0),
  dcr_value numeric(20, 6) NOT NULL CHECK (dcr_value >= 0),
  threshold numeric(20, 6) NOT NULL CHECK (threshold >= 0),
  state text NOT NULL CHECK (state IN ('WITHIN_LIMIT', 'BREACH')),
  formula_version text NOT NULL CHECK (length(trim(formula_version)) BETWEEN 1 AND 64),
  input_checksum_sha256 char(64) NOT NULL CHECK (input_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  calculated_by text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state = 'WITHIN_LIMIT' AND dcr_value >= threshold) OR (state = 'BREACH' AND dcr_value < threshold)),
  UNIQUE (pool_id, business_date, formula_version, input_checksum_sha256)
);

CREATE TABLE IF NOT EXISTS risk.stress_scenario (
  stress_scenario_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_code text NOT NULL CHECK (scenario_code ~ '^[A-Z][A-Z0-9_-]{1,63}$'),
  business_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'COMPLETED', 'ARCHIVED')),
  parameters jsonb NOT NULL,
  results jsonb,
  engine_version text NOT NULL,
  input_checksum_sha256 char(64) NOT NULL CHECK (input_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CHECK ((status = 'DRAFT' AND results IS NULL AND completed_at IS NULL) OR
         (status IN ('COMPLETED', 'ARCHIVED') AND results IS NOT NULL AND completed_at IS NOT NULL))
  , UNIQUE (scenario_code, business_date, engine_version, input_checksum_sha256)
);

CREATE OR REPLACE FUNCTION risk.reject_published_risk_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published risk result is append-only';
END;
$$;

DROP TRIGGER IF EXISTS dcr_calculation_no_mutation ON risk.dcr_calculation;
CREATE TRIGGER dcr_calculation_no_mutation BEFORE UPDATE OR DELETE ON risk.dcr_calculation
FOR EACH ROW EXECUTE FUNCTION risk.reject_published_risk_mutation();

CREATE OR REPLACE FUNCTION risk.guard_stress_scenario_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status IN ('COMPLETED', 'ARCHIVED') THEN
    RAISE EXCEPTION 'Published stress scenario is immutable';
  END IF;
  IF NOT (OLD.status = 'DRAFT' AND NEW.status = 'COMPLETED') THEN
    RAISE EXCEPTION 'Invalid stress scenario transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stress_scenario_guard ON risk.stress_scenario;
CREATE TRIGGER stress_scenario_guard BEFORE UPDATE OR DELETE ON risk.stress_scenario
FOR EACH ROW EXECUTE FUNCTION risk.guard_stress_scenario_mutation();

COMMIT;
