import { Money } from '../../../shared-kernel/money.js';
import type { DocumentContent } from '../../documents/application/document-ports.js';

export interface InvestmentPositionRow {
  accountId: string;
  customerToken: string;
  productCode: string;
  currency: string;
  openedOn: string;
  businessDate: string;
  valueDate: string;
  balance: string;
}

export interface InvestmentPositionStagingRepository {
  stage(batchId: string, rows: readonly InvestmentPositionRow[]): Promise<void>;
}

export class StageInvestmentPositions {
  constructor(private readonly repository: InvestmentPositionStagingRepository) {}

  async execute(batchId: string, content: DocumentContent): Promise<number> {
    if (content.mediaType !== 'text/csv' && content.mediaType !== 'application/csv') {
      throw new TypeError('Investment positions batch must be CSV');
    }
    const rows = parseInvestmentPositionsCsv(new TextDecoder('utf-8', { fatal: true }).decode(content.bytes));
    if (rows.length === 0) throw new TypeError('Investment positions batch is empty');
    await this.repository.stage(batchId, rows);
    return rows.length;
  }
}

export function parseInvestmentPositionsCsv(csv: string): InvestmentPositionRow[] {
  const records = parseCsv(csv.replace(/^\uFEFF/, ''));
  const expected = [
    'account_id', 'customer_token', 'product_code', 'currency',
    'opened_on', 'business_date', 'value_date', 'balance',
  ];
  const header = records.shift();
  if (!header || header.join(',') !== expected.join(',')) throw new TypeError('Unexpected investment positions CSV header');
  return records.filter((record) => !(record.length === 1 && record[0] === '')).map((record, index) => {
    if (record.length !== expected.length) throw new TypeError(`Invalid CSV column count at row ${index + 2}`);
    const [accountId, customerToken, productCode, currency, openedOn, businessDate, valueDate, balance] = record;
    if (!accountId || !customerToken || !productCode || !currency || !openedOn || !businessDate || !valueDate || !balance) {
      throw new TypeError(`Missing investment position value at row ${index + 2}`);
    }
    if (!/^[0-9a-f-]{36}$/i.test(accountId)) throw new TypeError(`Invalid account identifier at row ${index + 2}`);
    if (!/^tok_[A-Za-z0-9_-]{16,}$/.test(customerToken)) throw new TypeError(`Untokenized customer at row ${index + 2}`);
    for (const [name, value] of [['opened_on', openedOn], ['business_date', businessDate], ['value_date', valueDate]]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`Invalid ${name} at row ${index + 2}`);
    }
    Money.parse(balance, currency, 12);
    return { accountId, customerToken, productCode, currency, openedOn, businessDate, valueDate, balance };
  });
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field === '') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  if (quoted) throw new TypeError('Unterminated quoted CSV field');
  if (field !== '' || row.length > 0) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
