BEGIN;
CREATE SCHEMA IF NOT EXISTS reporting;
CREATE TABLE IF NOT EXISTS reporting.planning_scenario(
 scenario_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pool_id text NOT NULL REFERENCES pooling.pool(pool_id),
 scenario_kind text NOT NULL CHECK(scenario_kind IN('CENTRAL','OPTIMISTIC','STRESSED')),version integer NOT NULL CHECK(version>0),
 start_month date NOT NULL CHECK(EXTRACT(day FROM start_month)=1),owner_id text NOT NULL,status text NOT NULL CHECK(status IN('DRAFT','SUBMITTED','VALIDATED','OFFICIAL_BUDGET')),
 assumptions jsonb NOT NULL,source_closing_id uuid NOT NULL REFERENCES workflow.closing_period(closing_id),source_business_date date NOT NULL,
 source_snapshot_checksum text NOT NULL CHECK(source_snapshot_checksum~'^[a-f0-9]{64}$'),source_snapshot jsonb NOT NULL,projection jsonb NOT NULL CHECK(jsonb_array_length(projection)=12),
 validated_by text,promoted_by text,idempotency_key text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(pool_id,scenario_kind,version),CHECK(validated_by IS NULL OR validated_by<>owner_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_official_budget_per_pool_month ON reporting.planning_scenario(pool_id,start_month)WHERE status='OFFICIAL_BUDGET';
CREATE TABLE IF NOT EXISTS reporting.planning_scenario_history(history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),scenario_id uuid NOT NULL REFERENCES reporting.planning_scenario(scenario_id),previous_status text NOT NULL,resulting_status text NOT NULL,actor_id text NOT NULL,idempotency_key text NOT NULL UNIQUE,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE OR REPLACE FUNCTION reporting.guard_planning_scenario_history()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF TG_OP<>'INSERT'THEN RAISE EXCEPTION 'Planning scenario history is append-only';END IF;IF NOT((NEW.previous_status='DRAFT'AND NEW.resulting_status='SUBMITTED')OR(NEW.previous_status='SUBMITTED'AND NEW.resulting_status='VALIDATED')OR(NEW.previous_status='VALIDATED'AND NEW.resulting_status='OFFICIAL_BUDGET'))THEN RAISE EXCEPTION 'Invalid planning scenario transition';END IF;RETURN NEW;END;$$;
CREATE TRIGGER planning_scenario_history_guard BEFORE INSERT OR UPDATE OR DELETE ON reporting.planning_scenario_history FOR EACH ROW EXECUTE FUNCTION reporting.guard_planning_scenario_history();
CREATE OR REPLACE FUNCTION reporting.protect_planning_source_data()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF OLD.status<>'DRAFT'AND(NEW.assumptions<>OLD.assumptions OR NEW.source_snapshot<>OLD.source_snapshot OR NEW.projection<>OLD.projection OR NEW.source_closing_id<>OLD.source_closing_id)THEN RAISE EXCEPTION 'Submitted planning scenario inputs are immutable';END IF;RETURN NEW;END;$$;
CREATE TRIGGER planning_scenario_source_immutable BEFORE UPDATE ON reporting.planning_scenario FOR EACH ROW EXECUTE FUNCTION reporting.protect_planning_source_data();
COMMIT;
