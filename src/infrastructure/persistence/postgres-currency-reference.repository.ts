import type {
  CurrencyDefinition,
  CurrencyReferenceRepository,
} from '../../modules/reference-data/application/currency-reference.js';
import type { SqlClient } from './postgres-client.js';

interface CurrencyRow {
  currency_code: string;
  display_name: string;
  fraction_digits: number;
  valid_from: string;
  valid_until: string | null;
}

export class PostgresCurrencyReferenceRepository implements CurrencyReferenceRepository {
  constructor(private readonly database: SqlClient) {}

  async findEffective(code: string, businessDate: string): Promise<CurrencyDefinition | undefined> {
    const result = await this.database.query<CurrencyRow>(
      `SELECT currency_code, display_name, fraction_digits,
              valid_from::text, valid_until::text
       FROM reference.currency_version
       WHERE currency_code = $1
         AND valid_from <= $2::date
         AND (valid_until IS NULL OR valid_until > $2::date)`,
      [code, businessDate],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      code: row.currency_code,
      name: row.display_name,
      fractionDigits: row.fraction_digits,
      validFrom: row.valid_from,
      validUntil: row.valid_until ?? undefined,
    };
  }
}
