BEGIN;
CREATE OR REPLACE FUNCTION pooling.prevent_asset_overallocation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE maximum_allocated numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.asset_id::text, 0));
  WITH boundaries AS (
    SELECT NEW.effective_from AS point
    UNION
    SELECT effective_from
    FROM pooling.asset_allocation_version
    WHERE asset_id = NEW.asset_id
      AND allocation_id <> NEW.allocation_id
      AND effective_from < COALESCE(NEW.effective_to, 'infinity'::date)
      AND COALESCE(effective_to, 'infinity'::date) > NEW.effective_from
  ), totals AS (
    SELECT point, COALESCE((
      SELECT sum(percentage)
      FROM pooling.asset_allocation_version allocation
      WHERE allocation.asset_id = NEW.asset_id
        AND allocation.allocation_id <> NEW.allocation_id
        AND allocation.effective_from <= boundaries.point
        AND COALESCE(allocation.effective_to, 'infinity'::date) > boundaries.point
    ), 0) + NEW.percentage AS allocated
    FROM boundaries
  ) SELECT COALESCE(max(allocated), NEW.percentage) INTO maximum_allocated FROM totals;
  IF maximum_allocated > 100 THEN RAISE EXCEPTION 'Asset allocation exceeds 100 percent'; END IF;
  RETURN NEW;
END;
$$;
COMMIT;
