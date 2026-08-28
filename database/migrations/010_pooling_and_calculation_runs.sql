BEGIN;

CREATE TABLE IF NOT EXISTS pooling.pool (
  pool_id text PRIMARY KEY,
  display_name text NOT NULL,
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  amount_scale smallint NOT NULL DEFAULT 12 CHECK (amount_scale BETWEEN 0 AND 12),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS pooling.participant_version (
  pool_id text NOT NULL REFERENCES pooling.pool(pool_id),
  account_id uuid NOT NULL REFERENCES investment.account(account_id),
  weight numeric(30, 12) NOT NULL CHECK (weight >= 0),
  valid_from date NOT NULL,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (pool_id, account_id, valid_from),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS pooling.distributable_result (
  pool_id text NOT NULL REFERENCES pooling.pool(pool_id),
  business_date date NOT NULL,
  amount numeric(30, 12) NOT NULL,
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (pool_id, business_date),
  FOREIGN KEY (pool_id, currency_code) REFERENCES pooling.pool(pool_id, currency_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS pool_currency_unique
  ON pooling.pool (pool_id, currency_code);

CREATE TABLE IF NOT EXISTS calculation.run (
  run_id uuid PRIMARY KEY,
  pool_id text NOT NULL REFERENCES pooling.pool(pool_id),
  business_date date NOT NULL,
  rules_version text NOT NULL,
  engine_version text NOT NULL,
  correlation_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN (
    'DRAFT', 'CALCULATED', 'CONTROLLED', 'APPROVED', 'POSTED', 'ARCHIVED', 'FAILED'
  )),
  input_checksum_sha256 text CHECK (input_checksum_sha256 IS NULL OR input_checksum_sha256 ~ '^[a-f0-9]{64}$'),
  output_checksum_sha256 text CHECK (output_checksum_sha256 IS NULL OR output_checksum_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  calculated_at timestamptz,
  UNIQUE (pool_id, business_date, rules_version)
);

CREATE TABLE IF NOT EXISTS calculation.allocation_result (
  run_id uuid NOT NULL REFERENCES calculation.run(run_id),
  participant_id uuid NOT NULL REFERENCES investment.account(account_id),
  amount numeric(30, 12) NOT NULL,
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (run_id, participant_id)
);

COMMIT;
