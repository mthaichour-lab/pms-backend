import type {
  CurrencyAdministrationRepository,
  CurrencyDefinition,
  CurrencyReferencePage,
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

export class PostgresCurrencyReferenceRepository implements CurrencyReferenceRepository, CurrencyAdministrationRepository {
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

  async listEffective(businessDate: string, limit: number, offset: number): Promise<CurrencyReferencePage> {
    const [currencies, count] = await Promise.all([
      this.database.query<CurrencyRow>(
        `SELECT currency_code, display_name, fraction_digits,
                valid_from::text, valid_until::text
         FROM reference.currency_version
         WHERE valid_from <= $1::date
           AND (valid_until IS NULL OR valid_until > $1::date)
         ORDER BY currency_code
         LIMIT $2 OFFSET $3`,
        [businessDate, limit, offset],
      ),
      this.database.query<{ total: string }>(
        `SELECT count(*)::text AS total
         FROM reference.currency_version
         WHERE valid_from <= $1::date
           AND (valid_until IS NULL OR valid_until > $1::date)`,
        [businessDate],
      ),
    ]);
    return { items: currencies.rows.map(mapCurrency), total: Number(count.rows[0]?.total ?? 0) };
  }

  async saveVersion(currency: CurrencyDefinition, actorId: string): Promise<CurrencyDefinition> {
    const inserted = await this.database.query<CurrencyRow>(
      `WITH close_preceding_version AS (
         UPDATE reference.currency_version
         SET valid_until = $4::date
         WHERE currency_code = $1
           AND valid_from < $4::date
           AND (valid_until IS NULL OR valid_until > $4::date)
       )
       INSERT INTO reference.currency_version
          (currency_code, display_name, fraction_digits, valid_from, valid_until, created_by)
       VALUES ($1, $2, $3, $4::date, $5::date, $6)
       ON CONFLICT (currency_code, valid_from) DO NOTHING
       RETURNING currency_code, display_name, fraction_digits, valid_from::text, valid_until::text`,
      [currency.code, currency.name, currency.fractionDigits, currency.validFrom, currency.validUntil ?? null, actorId],
    );
    if (inserted.rows[0]) return mapCurrency(inserted.rows[0]);

    const existing = await this.database.query<CurrencyRow>(
      `SELECT currency_code, display_name, fraction_digits, valid_from::text, valid_until::text
       FROM reference.currency_version WHERE currency_code = $1 AND valid_from = $2::date`,
      [currency.code, currency.validFrom],
    );
    const stored = existing.rows[0];
    if (!stored) throw new Error('Currency version could not be persisted');
    const resolved = mapCurrency(stored);
    if (resolved.name !== currency.name || resolved.fractionDigits !== currency.fractionDigits || resolved.validUntil !== currency.validUntil) {
      throw new Error('Currency version already exists with different content');
    }
    return resolved;
  }
}

function mapCurrency(row: CurrencyRow): CurrencyDefinition {
  return {
    code: row.currency_code,
    name: row.display_name,
    fractionDigits: row.fraction_digits,
    validFrom: row.valid_from,
    ...(row.valid_until ? { validUntil: row.valid_until } : {}),
  };
}
