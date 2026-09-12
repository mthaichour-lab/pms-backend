import { describe, expect, it, vi } from 'vitest';

import {
  parseInvestmentPositionsCsv,
  StageInvestmentPositions,
} from '../../../src/modules/cbs-ingestion/application/stage-investment-positions.js';

const header = 'account_id,customer_id,product_code,currency,opened_on,business_date,value_date,balance';
const row = '17146c36-a0cb-4e0a-b095-60b67c945eb9,CBS-CUSTOMER-42,MUDARABA,DZD,2026-01-01,2026-08-28,2026-08-27,1250.250000000000';

describe('StageInvestmentPositions', () => {
  it('parses the contracted CSV and stages exact decimal values', async () => {
    const stage = vi.fn().mockResolvedValue(undefined);
    const useCase = new StageInvestmentPositions({ stage });
    await expect(useCase.execute('a1d817e4-657f-475f-a96a-7eecb8f93acc', {
      bytes: new TextEncoder().encode(`${header}\n${row}\n`),
      filename: 'positions.csv', mediaType: 'text/csv',
    })).resolves.toBe(1);
    expect(stage).toHaveBeenCalledWith(expect.any(String), [expect.objectContaining({
      currency: 'DZD', balance: '1250.250000000000',
    })]);
  });

  it('supports quoted fields but rejects unsafe customer references', () => {
    expect(parseInvestmentPositionsCsv(`${header}\n${row.replace('MUDARABA', '"MUDARABA"')}`)).toHaveLength(1);
    expect(() => parseInvestmentPositionsCsv(`${header}\n${row.replace('CBS-CUSTOMER-42', 'customer with spaces')}`)).toThrow('Invalid customer');
  });
});
