BEGIN;
ALTER TABLE pooling.asset_position ADD COLUMN IF NOT EXISTS financing_type text,ADD COLUMN IF NOT EXISTS customer_token text CHECK(customer_token IS NULL OR customer_token~'^tok_[A-Za-z0-9_-]{16,128}$'),ADD COLUMN IF NOT EXISTS sector_code text,ADD COLUMN IF NOT EXISTS designated_project_code text;
CREATE INDEX IF NOT EXISTS asset_position_quotation_dimensions_idx ON pooling.asset_position(financing_type,sector_code,designated_project_code);
COMMENT ON COLUMN pooling.asset_position.customer_token IS 'Tokenized customer dimension only; clear customer identifiers are forbidden.';
COMMIT;
