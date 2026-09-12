BEGIN;

CREATE TABLE IF NOT EXISTS calculation.reserve_movement (
  reserve_movement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES calculation.run(run_id),
  reserve_type text NOT NULL CHECK (reserve_type IN ('PER', 'IRR')),
  movement_kind text NOT NULL CHECK (movement_kind IN ('FUND', 'RELEASE', 'UTILIZE', 'ADJUST')),
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  opening_balance numeric(30, 12) NOT NULL CHECK (opening_balance >= 0),
  movement_amount numeric(30, 12) NOT NULL,
  closing_balance numeric(30, 12) NOT NULL CHECK (closing_balance >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (run_id, reserve_type),
  CHECK (closing_balance = opening_balance + movement_amount),
  CHECK (movement_kind <> 'FUND' OR movement_amount >= 0),
  CHECK (movement_kind NOT IN ('RELEASE', 'UTILIZE') OR movement_amount <= 0)
);

CREATE TABLE IF NOT EXISTS accounting.journal_entry (
  journal_entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid UNIQUE REFERENCES calculation.run(run_id),
  business_date date NOT NULL,
  entry_kind text NOT NULL CHECK (entry_kind IN ('PROFIT_ALLOCATION', 'RESERVE', 'REVERSAL')),
  status text NOT NULL CHECK (status IN ('DRAFT', 'POSTED')),
  reversal_of uuid UNIQUE REFERENCES accounting.journal_entry(journal_entry_id),
  correlation_id uuid NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  posted_at timestamptz,
  CHECK ((status = 'POSTED') = (posted_at IS NOT NULL)),
  CHECK ((entry_kind = 'REVERSAL') = (reversal_of IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS accounting.journal_line (
  journal_entry_id uuid NOT NULL REFERENCES accounting.journal_entry(journal_entry_id),
  line_number integer NOT NULL CHECK (line_number > 0),
  account_code text NOT NULL CHECK (account_code ~ '^[A-Z0-9a-f:_-]{2,128}$'),
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  debit numeric(30, 12) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(30, 12) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  participant_id uuid REFERENCES investment.account(account_id),
  PRIMARY KEY (journal_entry_id, line_number),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE OR REPLACE FUNCTION accounting.validate_journal_before_posting()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'POSTED' AND OLD.status = 'DRAFT' THEN
    IF EXISTS (
      SELECT 1 FROM accounting.journal_line
      WHERE journal_entry_id = NEW.journal_entry_id
      GROUP BY currency_code
      HAVING sum(debit) <> sum(credit)
    ) OR (SELECT count(*) FROM accounting.journal_line
          WHERE journal_entry_id = NEW.journal_entry_id) < 2 THEN
      RAISE EXCEPTION 'Journal entry is not balanced';
    END IF;
  ELSIF OLD.status = 'POSTED' THEN
    RAISE EXCEPTION 'Posted journal entry is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION accounting.reject_posted_line_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounting.journal_entry
             WHERE journal_entry_id = OLD.journal_entry_id AND status = 'POSTED') THEN
    RAISE EXCEPTION 'Posted journal line is immutable';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS journal_entry_posting_guard ON accounting.journal_entry;
CREATE TRIGGER journal_entry_posting_guard
BEFORE UPDATE OR DELETE ON accounting.journal_entry
FOR EACH ROW EXECUTE FUNCTION accounting.validate_journal_before_posting();

DROP TRIGGER IF EXISTS journal_line_mutation_guard ON accounting.journal_line;
CREATE TRIGGER journal_line_mutation_guard
BEFORE UPDATE OR DELETE ON accounting.journal_line
FOR EACH ROW EXECUTE FUNCTION accounting.reject_posted_line_mutation();

COMMIT;
