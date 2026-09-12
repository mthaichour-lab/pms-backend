BEGIN;
CREATE TABLE IF NOT EXISTS reporting.historical_yield_forecast(
 forecast_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pool_id text NOT NULL REFERENCES pooling.pool(pool_id),scope text NOT NULL CHECK(scope='POOL'),
 method text NOT NULL CHECK(method='MOVING_AVERAGE_AND_LINEAR_TREND'),complements_manual_scenarios boolean NOT NULL CHECK(complements_manual_scenarios),
 source_observations jsonb NOT NULL CHECK(jsonb_array_length(source_observations)>=3),source_checksum_sha256 text NOT NULL CHECK(source_checksum_sha256~'^[a-f0-9]{64}$'),
 points jsonb NOT NULL CHECK(jsonb_array_length(points)=12),created_by text NOT NULL,idempotency_key text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION reporting.reject_historical_forecast_mutation()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Historical yield forecast is immutable';END;$$;
CREATE TRIGGER historical_forecast_immutable BEFORE UPDATE OR DELETE ON reporting.historical_yield_forecast FOR EACH ROW EXECUTE FUNCTION reporting.reject_historical_forecast_mutation();
COMMIT;
