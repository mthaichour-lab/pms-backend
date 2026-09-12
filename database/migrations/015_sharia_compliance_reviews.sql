BEGIN;

CREATE TABLE IF NOT EXISTS compliance.sharia_review (
  review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (length(trim(resource_type)) BETWEEN 2 AND 64),
  resource_id text NOT NULL CHECK (length(trim(resource_id)) BETWEEN 1 AND 128),
  status text NOT NULL CHECK (status IN ('SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED')),
  maker_id text NOT NULL,
  reviewer_id text,
  approver_id text,
  opinion text,
  justification text,
  evidence_document_id uuid REFERENCES document.document_reference(document_reference_id),
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_at timestamptz,
  decided_at timestamptz,
  CHECK (reviewer_id IS NULL OR reviewer_id <> maker_id),
  CHECK (approver_id IS NULL OR (approver_id <> maker_id AND approver_id <> reviewer_id)),
  CHECK (
    (status = 'SUBMITTED' AND reviewer_id IS NULL AND approver_id IS NULL AND reviewed_at IS NULL AND decided_at IS NULL) OR
    (status = 'REVIEWED' AND reviewer_id IS NOT NULL AND length(trim(opinion)) >= 10 AND reviewed_at IS NOT NULL AND approver_id IS NULL AND decided_at IS NULL) OR
    (status IN ('APPROVED', 'REJECTED') AND reviewer_id IS NOT NULL AND approver_id IS NOT NULL
      AND length(trim(opinion)) >= 10 AND length(trim(justification)) >= 10
      AND evidence_document_id IS NOT NULL AND reviewed_at IS NOT NULL AND decided_at IS NOT NULL)
  ),
  UNIQUE (resource_type, resource_id)
);

CREATE OR REPLACE FUNCTION compliance.guard_sharia_review_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Sharia review cannot be deleted';
  END IF;
  IF OLD.status IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Decided Sharia review is immutable';
  END IF;
  IF NOT ((OLD.status = 'SUBMITTED' AND NEW.status = 'REVIEWED') OR
          (OLD.status = 'REVIEWED' AND NEW.status IN ('APPROVED', 'REJECTED'))) THEN
    RAISE EXCEPTION 'Invalid Sharia review transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sharia_review_guard ON compliance.sharia_review;
CREATE TRIGGER sharia_review_guard BEFORE UPDATE OR DELETE ON compliance.sharia_review
FOR EACH ROW EXECUTE FUNCTION compliance.guard_sharia_review_mutation();

COMMIT;
