BEGIN;

ALTER TABLE integration.cbs_investment_position_staging
  ADD COLUMN IF NOT EXISTS customer_reference text,
  ADD COLUMN IF NOT EXISTS tokenized_at timestamptz;
ALTER TABLE integration.cbs_investment_position_staging ALTER COLUMN customer_token DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cbs_batch_published_event
  ON integration.outbox_event (aggregate_id, event_type)
  WHERE event_type = 'pms.cbs.batch.published.v1';

COMMENT ON COLUMN integration.cbs_investment_position_staging.customer_reference IS
  'Restricted transient CBS identifier; never copied to Core and tokenized before publication.';

COMMIT;
