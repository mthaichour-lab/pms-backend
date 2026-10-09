BEGIN;
ALTER TABLE revenue.recognized_income ADD COLUMN IF NOT EXISTS gl_account_code text;
ALTER TABLE revenue.recognized_income ADD COLUMN IF NOT EXISTS maturity_date date;
UPDATE revenue.recognized_income SET gl_account_code = 'REV:' || income_type WHERE gl_account_code IS NULL;
ALTER TABLE revenue.recognized_income ALTER COLUMN gl_account_code SET NOT NULL;
ALTER TABLE revenue.recognized_income ADD CONSTRAINT recognized_income_gl_account_code_check CHECK (gl_account_code ~ '^[A-Z0-9a-f:_-]{2,128}$');
CREATE INDEX IF NOT EXISTS recognized_income_pool_gl_idx ON revenue.recognized_income (pool_id, gl_account_code);
CREATE INDEX IF NOT EXISTS recognized_income_maturity_idx ON revenue.recognized_income (maturity_date) WHERE maturity_date IS NOT NULL;
COMMIT;
