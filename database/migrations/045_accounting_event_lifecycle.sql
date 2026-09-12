BEGIN;

ALTER TABLE accounting.journal_entry DROP CONSTRAINT IF EXISTS journal_entry_entry_kind_check;
ALTER TABLE accounting.journal_entry ADD CONSTRAINT journal_entry_entry_kind_check
  CHECK (entry_kind IN ('PROFIT_ALLOCATION','RESERVE','REVERSAL','BUSINESS_EVENT'));
ALTER TABLE accounting.journal_entry ALTER COLUMN run_id DROP NOT NULL;
ALTER TABLE accounting.journal_entry DROP CONSTRAINT IF EXISTS journal_entry_run_id_key;
ALTER TABLE accounting.journal_entry
  ADD COLUMN IF NOT EXISTS pool_id text REFERENCES pooling.pool(pool_id),
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES product.investment_product(product_id),
  ADD COLUMN IF NOT EXISTS source_event_type text CHECK(source_event_type IS NULL OR source_event_type IN('REVENUE','PROFIT_SHARE','PER_MOVEMENT','IRR_MOVEMENT','PURIFICATION','WITHHOLDING_TAX','REMAINDER','CORRECTION')),
  ADD COLUMN IF NOT EXISTS source_event_id text,
  ADD COLUMN IF NOT EXISTS source_key text,
  ADD COLUMN IF NOT EXISTS issuance_status text NOT NULL DEFAULT 'EMITTED' CHECK(issuance_status='EMITTED'),
  ADD COLUMN IF NOT EXISTS acknowledgement_status text NOT NULL DEFAULT 'PENDING' CHECK(acknowledgement_status IN('PENDING','ACKNOWLEDGED','REJECTED','RETRIED','REVERSED'));
CREATE UNIQUE INDEX IF NOT EXISTS journal_source_key_unique ON accounting.journal_entry(source_key) WHERE source_key IS NOT NULL;
ALTER TABLE accounting.journal_line ADD COLUMN IF NOT EXISTS entity_id text;

CREATE TABLE IF NOT EXISTS accounting.posting_acknowledgement(
  acknowledgement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES accounting.journal_entry(journal_entry_id),
  previous_state text NOT NULL,
  resulting_state text NOT NULL,
  external_reference text NOT NULL,
  reason text,
  actor_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(resulting_state<>'REJECTED' OR length(trim(reason))>=10)
);

CREATE OR REPLACE FUNCTION accounting.validate_acknowledgement_transition()
RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
  IF NOT ((NEW.previous_state='PENDING' AND NEW.resulting_state IN('ACKNOWLEDGED','REJECTED')) OR
    (NEW.previous_state='REJECTED' AND NEW.resulting_state='RETRIED') OR
    (NEW.previous_state='RETRIED' AND NEW.resulting_state IN('ACKNOWLEDGED','REJECTED','REVERSED'))) THEN
    RAISE EXCEPTION 'Invalid accounting acknowledgement transition';
  END IF;
  IF NEW.previous_state<>(SELECT acknowledgement_status FROM accounting.journal_entry WHERE journal_entry_id=NEW.journal_entry_id) THEN
    RAISE EXCEPTION 'Stale accounting acknowledgement state';
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER posting_acknowledgement_transition_guard BEFORE INSERT ON accounting.posting_acknowledgement
FOR EACH ROW EXECUTE FUNCTION accounting.validate_acknowledgement_transition();

CREATE OR REPLACE FUNCTION accounting.reject_acknowledgement_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Accounting acknowledgement history is append-only';END;$$;
CREATE TRIGGER posting_acknowledgement_immutable BEFORE UPDATE OR DELETE ON accounting.posting_acknowledgement
FOR EACH ROW EXECUTE FUNCTION accounting.reject_acknowledgement_mutation();

CREATE OR REPLACE FUNCTION accounting.validate_journal_before_posting()
RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
  IF NEW.status='POSTED' AND OLD.status='DRAFT' THEN
    IF EXISTS(SELECT 1 FROM accounting.journal_line WHERE journal_entry_id=NEW.journal_entry_id GROUP BY currency_code,COALESCE(entity_id,'') HAVING sum(debit)<>sum(credit))
      OR (SELECT count(*) FROM accounting.journal_line WHERE journal_entry_id=NEW.journal_entry_id)<2 THEN
      RAISE EXCEPTION 'Journal entry is not balanced by currency and entity';
    END IF;
  ELSIF OLD.status='POSTED' AND (to_jsonb(NEW)-'acknowledgement_status') IS DISTINCT FROM (to_jsonb(OLD)-'acknowledgement_status') THEN
    RAISE EXCEPTION 'Posted journal entry is immutable';
  END IF;
  RETURN NEW;
END;$$;

COMMIT;
