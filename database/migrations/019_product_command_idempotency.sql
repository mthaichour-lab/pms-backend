BEGIN;

CREATE TABLE IF NOT EXISTS product.command_idempotency (
  idempotency_key text PRIMARY KEY CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  operation text NOT NULL,
  product_id uuid NOT NULL REFERENCES product.investment_product(product_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE product.command_idempotency IS
  'Commands are serialized with pg_advisory_xact_lock(hashtextextended(idempotency_key, 0)) before mutation.';

CREATE OR REPLACE FUNCTION product.prevent_command_idempotency_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Product command idempotency records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS product_command_idempotency_immutable ON product.command_idempotency;
CREATE TRIGGER product_command_idempotency_immutable BEFORE UPDATE OR DELETE ON product.command_idempotency
FOR EACH ROW EXECUTE FUNCTION product.prevent_command_idempotency_mutation();

COMMIT;
