import type { ReferenceData } from '../../modules/reference-data/application/regulatory-reference.js';
import type { RegulatoryAuthority, RegulatoryRule } from '../../modules/reference-data/domain/regulatory-rule.js';
import type { SqlClient } from './postgres-client.js';

interface RuleRow { rule_code: string; version: number; authority: RegulatoryAuthority; legal_reference: string; effective_from: string; effective_to: string | null; parameters: Record<string, string>; }

export class PostgresRegulatoryReferenceRepository implements ReferenceData {
  constructor(private readonly database: SqlClient) {}

  async findEffectiveRegulatoryRule(ruleCode: string, businessDate: string): Promise<RegulatoryRule | undefined> {
    const result = await this.database.query<RuleRow>(
      `SELECT rule_code, version, authority, legal_reference, effective_from::text, effective_to::text, parameters
       FROM reference.regulatory_rule
       WHERE rule_code = $1 AND effective_from <= $2::date AND (effective_to IS NULL OR effective_to >= $2::date)
       ORDER BY version DESC LIMIT 1`, [ruleCode, businessDate],
    );
    const row = result.rows[0];
    return row ? { ruleCode: row.rule_code, version: row.version, authority: row.authority, legalReference: row.legal_reference, effectiveFrom: row.effective_from, effectiveTo: row.effective_to ?? undefined, parameters: Object.freeze({ ...row.parameters }) } : undefined;
  }
}
