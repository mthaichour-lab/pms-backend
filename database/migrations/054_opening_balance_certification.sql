BEGIN;
CREATE SCHEMA IF NOT EXISTS homologation;
ALTER TABLE calculation.run ADD COLUMN IF NOT EXISTS run_kind text NOT NULL DEFAULT 'PARALLEL' CHECK(run_kind IN('PARALLEL','PRODUCTION'));
CREATE TABLE IF NOT EXISTS homologation.opening_balance_certification(
  certification_id uuid PRIMARY KEY,status text NOT NULL CHECK(status='CERTIFIED'),signed_by text NOT NULL,
  signed_at timestamptz NOT NULL,evidence_checksum_sha256 text NOT NULL CHECK(evidence_checksum_sha256~'^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS homologation.opening_balance_reconciliation(
  certification_id uuid NOT NULL REFERENCES homologation.opening_balance_certification(certification_id),
  component text NOT NULL CHECK(component IN('HISTORICAL_ACCOUNTS','PER','IRR','PAST_DISTRIBUTIONS')),
  currency_code text NOT NULL CHECK(currency_code~'^[A-Z]{3}$'),migrated_amount numeric(30,12) NOT NULL,
  general_ledger_amount numeric(30,12) NOT NULL,difference_amount numeric(30,12) NOT NULL CHECK(difference_amount=0),
  evidence_reference text NOT NULL,PRIMARY KEY(certification_id,component)
);
CREATE OR REPLACE FUNCTION homologation.guard_production_run_publication()RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.run_kind='PRODUCTION' AND NEW.status IN('APPROVED','POSTED','ARCHIVED') AND NOT EXISTS(
    SELECT 1 FROM homologation.opening_balance_certification certificate
    WHERE certificate.status='CERTIFIED' AND (SELECT count(*) FROM homologation.opening_balance_reconciliation line WHERE line.certification_id=certificate.certification_id)=4
  ) THEN RAISE EXCEPTION 'Production calculation publication blocked: opening balances are not Finance-certified'; END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS real_run_requires_opening_certification ON calculation.run;
CREATE TRIGGER real_run_requires_opening_certification BEFORE INSERT OR UPDATE ON calculation.run FOR EACH ROW EXECUTE FUNCTION homologation.guard_production_run_publication();
CREATE OR REPLACE FUNCTION homologation.reject_certification_mutation()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Opening balance certifications are append-only';END;$$;
DROP TRIGGER IF EXISTS opening_certification_immutable ON homologation.opening_balance_certification;
CREATE TRIGGER opening_certification_immutable BEFORE UPDATE OR DELETE ON homologation.opening_balance_certification FOR EACH ROW EXECUTE FUNCTION homologation.reject_certification_mutation();
DROP TRIGGER IF EXISTS opening_reconciliation_immutable ON homologation.opening_balance_reconciliation;
CREATE TRIGGER opening_reconciliation_immutable BEFORE UPDATE OR DELETE ON homologation.opening_balance_reconciliation FOR EACH ROW EXECUTE FUNCTION homologation.reject_certification_mutation();
COMMIT;
