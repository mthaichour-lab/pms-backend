BEGIN;

CREATE TABLE IF NOT EXISTS investment.account (
  account_id uuid PRIMARY KEY,
  customer_token text NOT NULL CHECK (customer_token ~ '^tok_[A-Za-z0-9_-]{16,}$'),
  product_code text NOT NULL,
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  opened_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  closed_on date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (account_id, currency_code),
  CHECK ((status = 'CLOSED') = (closed_on IS NOT NULL)),
  CHECK (closed_on IS NULL OR closed_on >= opened_on)
);

CREATE INDEX IF NOT EXISTS investment_account_customer_idx
  ON investment.account (customer_token) WHERE status <> 'CLOSED';

CREATE TABLE IF NOT EXISTS investment.position_snapshot (
  account_id uuid NOT NULL REFERENCES investment.account(account_id),
  business_date date NOT NULL,
  value_date date NOT NULL,
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  balance numeric(30, 12) NOT NULL,
  source_batch_id uuid NOT NULL REFERENCES integration.cbs_batch(batch_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_id, business_date, value_date, source_batch_id),
  FOREIGN KEY (account_id, currency_code)
    REFERENCES investment.account(account_id, currency_code)
);

COMMIT;
