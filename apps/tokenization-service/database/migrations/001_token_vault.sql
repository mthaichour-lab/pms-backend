BEGIN;

CREATE SCHEMA IF NOT EXISTS token_vault;

CREATE TABLE IF NOT EXISTS token_vault.secret_record (
  token text PRIMARY KEY CHECK (token ~ '^tok_[A-Za-z0-9_-]{16,128}$'),
  data_class text NOT NULL CHECK (data_class IN ('CUSTOMER_ID', 'NATIONAL_ID', 'ACCOUNT_HOLDER_NAME', 'CONTACT')),
  ciphertext text NOT NULL,
  encrypted_data_key text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  key_version text NOT NULL,
  search_digest_sha256 text NOT NULL CHECK (search_digest_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  rotated_at timestamptz,
  UNIQUE (data_class, search_digest_sha256)
);

CREATE TABLE IF NOT EXISTS token_vault.detokenization_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  actor_id text NOT NULL,
  purpose text NOT NULL CHECK (purpose ~ '^[A-Z][A-Z0-9_]{4,63}$'),
  correlation_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILURE')),
  occurred_at timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION token_vault.reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Detokenization audit is append-only'; END; $$;
DROP TRIGGER IF EXISTS detokenization_audit_immutable ON token_vault.detokenization_audit;
CREATE TRIGGER detokenization_audit_immutable BEFORE UPDATE OR DELETE ON token_vault.detokenization_audit
FOR EACH ROW EXECUTE FUNCTION token_vault.reject_audit_mutation();

REVOKE ALL ON SCHEMA token_vault FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA token_vault FROM PUBLIC;

COMMIT;
