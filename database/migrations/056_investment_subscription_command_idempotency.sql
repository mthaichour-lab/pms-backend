BEGIN;

CREATE TABLE IF NOT EXISTS investment.subscription_command (
  idempotency_key text PRIMARY KEY
    CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$'),
  account_id uuid NOT NULL REFERENCES investment.subscription_account(account_id),
  operation text NOT NULL CHECK (operation ~ '^[A-Z][A-Z_]+$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  correlation_id uuid NOT NULL,
  result_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE investment.subscription_command IS
  'Immutable command outcomes; pg_advisory_xact_lock serializes concurrent idempotency-key replays.';

CREATE OR REPLACE FUNCTION investment.prevent_subscription_command_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Investment subscription command evidence is immutable';
END;
$$;

DROP TRIGGER IF EXISTS subscription_command_immutable ON investment.subscription_command;
CREATE TRIGGER subscription_command_immutable
BEFORE UPDATE OR DELETE ON investment.subscription_command
FOR EACH ROW EXECUTE FUNCTION investment.prevent_subscription_command_mutation();

COMMIT;
