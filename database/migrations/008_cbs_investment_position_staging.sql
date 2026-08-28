BEGIN;

CREATE TABLE IF NOT EXISTS integration.cbs_investment_position_staging (
  batch_id uuid NOT NULL REFERENCES integration.cbs_batch(batch_id) ON DELETE CASCADE,
  row_number integer NOT NULL CHECK (row_number > 0),
  account_id uuid NOT NULL,
  customer_token text NOT NULL CHECK (customer_token ~ '^tok_[A-Za-z0-9_-]{16,}$'),
  product_code text NOT NULL,
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  opened_on date NOT NULL,
  business_date date NOT NULL,
  value_date date NOT NULL,
  balance numeric(30, 12) NOT NULL,
  staged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (batch_id, row_number),
  UNIQUE (batch_id, account_id, business_date, value_date)
);

COMMIT;
