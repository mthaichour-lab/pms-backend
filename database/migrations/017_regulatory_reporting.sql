BEGIN;

CREATE TABLE IF NOT EXISTS compliance.regulatory_report (
  regulatory_report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL CHECK (report_type ~ '^[A-Z][A-Z0-9_-]{1,63}$'),
  period char(7) NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text NOT NULL CHECK (status IN ('GENERATED', 'PUBLISHED')),
  snapshot jsonb NOT NULL,
  source_checksum_sha256 char(64) NOT NULL CHECK (source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  output_checksum_sha256 char(64) NOT NULL CHECK (output_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_document_id uuid REFERENCES document.document_reference(document_reference_id),
  generated_by text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_by text,
  published_at timestamptz,
  CHECK ((status = 'GENERATED' AND published_by IS NULL AND published_at IS NULL) OR
         (status = 'PUBLISHED' AND published_by IS NOT NULL AND published_at IS NOT NULL AND evidence_document_id IS NOT NULL)),
  UNIQUE (report_type, period, source_checksum_sha256)
);

CREATE OR REPLACE FUNCTION compliance.guard_regulatory_report_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published regulatory report is immutable';
  END IF;
  IF NOT (OLD.status = 'GENERATED' AND NEW.status = 'PUBLISHED') THEN
    RAISE EXCEPTION 'Invalid regulatory report transition';
  END IF;
  IF NEW.snapshot <> OLD.snapshot OR NEW.source_checksum_sha256 <> OLD.source_checksum_sha256
     OR NEW.output_checksum_sha256 <> OLD.output_checksum_sha256 THEN
    RAISE EXCEPTION 'Regulatory report content cannot change after generation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS regulatory_report_guard ON compliance.regulatory_report;
CREATE TRIGGER regulatory_report_guard BEFORE UPDATE OR DELETE ON compliance.regulatory_report
FOR EACH ROW EXECUTE FUNCTION compliance.guard_regulatory_report_mutation();

COMMIT;
