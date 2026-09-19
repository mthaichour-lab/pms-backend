import { readdir, readFile } from 'node:fs/promises';

const directory = new URL('../migrations/', import.meta.url);
const filenames = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
const missing = [];
for (const [index, filename] of filenames.entries()) {
  const expected = String(index + 1).padStart(3, '0');
  if (!filename.startsWith(`${expected}_`)) missing.push(`consecutive migration ${expected}`);
}
const migrations = new Map(
  await Promise.all(filenames.map(async (filename) => [filename, await readFile(new URL(filename, directory), 'utf8')])),
);
for (const [filename, sql] of migrations) {
  if (!/^BEGIN;/m.test(sql) || !/COMMIT;\s*$/m.test(sql)) missing.push(`${filename}: explicit transaction`);
  if (/\b(?:real|double\s+precision)\b/i.test(sql)) missing.push(`${filename}: floating-point financial type`);
}

const controls = {
  '001_platform_foundation.sql': [
    'CREATE SCHEMA IF NOT EXISTS iam_ref', 'CREATE SCHEMA IF NOT EXISTS integration',
    'CREATE TABLE IF NOT EXISTS integration.outbox_event', 'CREATE TABLE IF NOT EXISTS audit.event',
    'BEFORE UPDATE OR DELETE ON audit.event', 'numeric(30, 12)',
  ],
  '002_outbox_leases.sql': ['locked_by text', 'locked_until timestamptz'],
  '003_audit_signatures.sql': ['signing_key_id text NOT NULL', 'signature_base64 text NOT NULL'],
  '004_currency_reference.sql': [
    'CREATE TABLE IF NOT EXISTS reference.currency', 'reference.register_currency_identity',
    'currency_version_no_overlap', "daterange(valid_from, valid_until, '[)')",
  ],
  '005_cbs_ingestion.sql': ['integration.cbs_batch', "'QUARANTINED'", 'sequence_number'],
  '006_cbs_batch_transitions.sql': ['guard_cbs_batch_transition', 'cbs_batch_state_history'],
  '007_investment_accounts.sql': ['investment.account', 'investment.position_snapshot', 'numeric(30, 12)'],
  '008_cbs_investment_position_staging.sql': ['cbs_investment_position_staging', 'row_number'],
  '009_inbox_processing_leases.sql': ['processing_started_at', 'processing_attempts'],
  '010_pooling_and_calculation_runs.sql': [
    'pooling.participant_version', 'calculation.run', 'calculation.allocation_result',
    'input_snapshot jsonb', 'EXCLUDE USING gist',
  ],
  '011_closing_workflow.sql': ['workflow.closing_period', "'CONTROLS_PASSED'", 'checker_id'],
  '012_maker_checker_approvals.sql': [
    'maker_id text', 'controller_id text', 'workflow.approval_action',
    'approval_action is append-only',
  ],
  '013_reserves_and_accounting_ledger.sql': [
    'calculation.reserve_movement', 'closing_balance = opening_balance + movement_amount',
    'accounting.journal_entry', 'sum(debit) <> sum(credit)',
    'Posted journal entry is immutable', 'Posted journal line is immutable',
  ],
  '014_accounting_reconciliation.sql': [
    'accounting.reconciliation', 'difference = subledger_amount - general_ledger_amount',
    'reconciliation is append-only', "state IN ('MATCHED', 'VARIANCE')",
  ],
  '015_sharia_compliance_reviews.sql': [
    'compliance.sharia_review', 'Decided Sharia review is immutable',
    "status IN ('APPROVED', 'REJECTED')", 'evidence_document_id', 'Sharia review cannot be deleted',
  ],
  '016_risk_dcr_and_stress_scenarios.sql': [
    'risk.dcr_calculation', 'risk.stress_scenario', 'Published risk result is append-only',
    'Published stress scenario is immutable', "state IN ('WITHIN_LIMIT', 'BREACH')",
  ],
  '017_regulatory_reporting.sql': [
    'compliance.regulatory_report', 'Published regulatory report is immutable',
    'Regulatory report content cannot change after generation', 'evidence_document_id',
  ],
  '018_investment_products.sql': ['product.investment_product', 'product.product_transition', 'validated_by'],
  '019_product_command_idempotency.sql': ['product.command_idempotency', 'records are immutable', 'pg_advisory'],
  '020_product_terms_versioning.sql': ['product.terms_version', 'product_terms_no_published_overlap', 'Published product terms are immutable'],
  '021_product_terms_maker_checker_idempotency.sql': ['created_by text', 'NEW.created_by = OLD.created_by', 'product.terms_command_idempotency', 'pg_advisory'],
  '022_product_compliance_references.sql': ['product.compliance_reference', 'product.product_reference', 'product.compliance_arbitration', 'BA', 'SHARIA_COMMITTEE', 'AAOIFI', 'IFSB', 'append-only'],
  '023_algeria_regulatory_rule_pack.sql': ['reference.regulatory_rule', 'regulatory_rule_one_open_version', 'parameters jsonb', 'prevent_regulatory_rule_mutation'],
  '024_compliance_integrity_guards.sql': ['compliance_arbitration_selected_association_fk', 'compliance_arbitration_rejected_association_fk', 'enforce_compliance_arbitration_priority', 'regulatory_rule_effective_period_excl'],
  '038_calculation_run_integrity.sql': ['calculation.run_step', 'Approved calculation run is immutable', 'create a correction run'],
  '039_loss_notification_trace.sql': ['calculation.loss_event', 'calculation.loss_notification', 'Loss events and notifications are immutable', 'Loss notification evidence is immutable'],
  '040_reserve_governance.sql': ['calculation.reserve_policy', 'Reserve movement requires explicit approval before application', 'Reserve ownership conservation invariant failed'],
  '041_consolidated_dcr_and_full_stress.sql': ['risk.voluntary_support', 'risk.consolidated_dcr', 'full_engine_rerun', 'DCR support evidence and consolidated results are immutable'],
  '042_closing_workflow_19_steps.sql': ['workflow.closing_step_event', 'PROVISIONAL_CALCULATION', 'Closing workflow cannot skip a step', 'Closing workflow history is append-only'],
  '043_closing_maker_checker_rejection.sql': ['workflow.closing_rejection', 'Maker cannot approve or reject their own closing', 'Closing rejection evidence is immutable'],
  '044_closing_escalation_evidence.sql': ['workflow.closing_task_escalation', 'escalate_overdue_closing_tasks', 'ClosingTaskEscalated.v1', 'workflow.closing_evidence_package', 'ClosingEvidencePackageGenerated.v1', 'Closing evidence package is immutable'],
  '045_accounting_event_lifecycle.sql': ['accounting.posting_acknowledgement', 'journal_source_key_unique', 'Journal entry is not balanced by currency and entity', 'Accounting acknowledgement history is append-only'],
  '046_multi_system_reconciliation.sql': ['accounting.reconciliation_control', 'accounting.reconciliation_discrepancy', 'PURIFICATION_DISBURSEMENT', 'escalate_overdue_discrepancies', 'Reconciliation discrepancy history is append-only'],
  '047_exception_center_publication_guard.sql': ['workflow.exception_case', 'workflow.exception_case_history', 'assert_no_blocking_exception', 'Publication blocked by unresolved critical exception', 'Exception case history is append-only'],
  '048_planning_scenarios.sql': ['reporting.planning_scenario', 'CENTRAL', 'OPTIMISTIC', 'STRESSED', 'one_official_budget_per_pool_month', 'Submitted planning scenario inputs are immutable'],
  '049_historical_pool_yield_forecast.sql': ['reporting.historical_yield_forecast', "scope='POOL'", 'MOVING_AVERAGE_AND_LINEAR_TREND', 'complements_manual_scenarios', 'Historical yield forecast is immutable'],
  '050_audience_dashboard_compliance_floor.sql': ['reporting.dashboard_item_catalog', 'CDC-26.1', 'CDC-26.2', 'CDC-26.3', 'CDC-26.4', 'dashboard_snapshot_fast_read', 'CDC dashboard compliance floor is immutable'],
  '051_profit_explanation_output.sql': ['calculation.profit_explanation_output', 'capitalInvested', 'nonGuaranteedNotice', 'lossExplanation', 'Engine profit explanation output is immutable'],
  '052_secure_report_exports.sql': ['reporting.secure_export', 'PENDING_REINFORCED_APPROVAL', 'approved_by<>requester_id', 'Secure export approval history is append-only', 'Generated secure export is immutable'],
  '053_quotation_basis_dimensions.sql': ['financing_type', 'customer_token', 'designated_project_code', 'clear customer identifiers are forbidden'],
  '055_document_archive_request.sql': ['document.archive_request', "status IN ('QUEUED','ARCHIVED')", 'idempotency_key text NOT NULL UNIQUE', 'paperless_document_id'],
  '056_investment_subscription_command_idempotency.sql': ['investment.subscription_command', 'pg_advisory_xact_lock', 'result_snapshot jsonb NOT NULL', 'subscription_command_immutable'],
  '057_secure_export_expiration.sql': [
    'expires_at timestamptz', 'secure_export_expiration_after_creation',
    'DISABLE TRIGGER generated_secure_export_immutable',
    'ENABLE TRIGGER generated_secure_export_immutable', "TG_OP = 'DELETE'",
    'RETURN OLD', 'secure_export_expiration_idx',
  ],
};

for (const [filename, fragments] of Object.entries(controls)) {
  const sql = migrations.get(filename);
  if (!sql) {
    missing.push(`missing migration ${filename}`);
    continue;
  }
  for (const fragment of fragments) {
    if (!sql.includes(fragment)) missing.push(`${filename}: ${fragment}`);
  }
}

if (missing.length > 0) {
  console.error(`Database migrations are incomplete:\n${missing.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`${filenames.length} ordered migrations contain all mandatory controls.`);
}
