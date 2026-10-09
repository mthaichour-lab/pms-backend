BEGIN;
ALTER TABLE revenue.recognized_income ADD COLUMN IF NOT EXISTS gl_account_code text;
ALTER TABLE revenue.recognized_income ADD COLUMN IF NOT EXISTS maturity_date date;
-- income_type is unconstrained free text, so deriving a ledger code from it
-- verbatim can violate the CHECK added below and abort this migration on any
-- database that already holds income. Uppercase it, fold every character the
-- ledger domain rejects into an underscore, and bound the length so the
-- derived code always satisfies the constraint.
UPDATE revenue.recognized_income
SET gl_account_code = 'REV:' || left(regexp_replace(upper(income_type), '[^A-Z0-9:_-]', '_', 'g'), 124)
WHERE gl_account_code IS NULL;
ALTER TABLE revenue.recognized_income ALTER COLUMN gl_account_code SET NOT NULL;
ALTER TABLE revenue.recognized_income ADD CONSTRAINT recognized_income_gl_account_code_check CHECK (gl_account_code ~ '^[A-Z0-9a-f:_-]{2,128}$');
CREATE INDEX IF NOT EXISTS recognized_income_pool_gl_idx ON revenue.recognized_income (pool_id, gl_account_code);
CREATE INDEX IF NOT EXISTS recognized_income_maturity_idx ON revenue.recognized_income (maturity_date) WHERE maturity_date IS NOT NULL;
COMMIT;
