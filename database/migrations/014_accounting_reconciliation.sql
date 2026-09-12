BEGIN;

CREATE TABLE IF NOT EXISTS accounting.reconciliation (
  reconciliation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date date NOT NULL,
  currency_code char(3) NOT NULL REFERENCES reference.currency(currency_code),
  subledger_amount numeric(38, 12) NOT NULL,
  general_ledger_amount numeric(38, 12) NOT NULL,
  difference numeric(38, 12) NOT NULL,
  source_reference text NOT NULL CHECK (length(trim(source_reference)) BETWEEN 3 AND 256),
  source_checksum_sha256 char(64) NOT NULL CHECK (source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('MATCHED', 'VARIANCE')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (difference = subledger_amount - general_ledger_amount),
  CHECK ((state = 'MATCHED' AND difference = 0) OR (state = 'VARIANCE' AND difference <> 0)),
  UNIQUE (business_date, currency_code, source_checksum_sha256)
);

CREATE OR REPLACE FUNCTION accounting.reject_reconciliation_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'accounting.reconciliation is append-only';
END;
$$;

DROP TRIGGER IF EXISTS reconciliation_no_mutation ON accounting.reconciliation;
CREATE TRIGGER reconciliation_no_mutation
BEFORE UPDATE OR DELETE ON accounting.reconciliation
FOR EACH ROW EXECUTE FUNCTION accounting.reject_reconciliation_mutation();

COMMIT;
