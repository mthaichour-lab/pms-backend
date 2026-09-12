import { describe, expect, it } from 'vitest';
import { certifyOpeningBalances, type OpeningBalanceEvidence } from '../../../src/modules/accounting/domain/opening-balance-certification.js';

const lines: OpeningBalanceEvidence[] = [
  ['HISTORICAL_ACCOUNTS', '1000.00'], ['PER', '120.00'], ['IRR', '80.00'], ['PAST_DISTRIBUTIONS', '250.00'],
].map(([component, amount]) => ({
  component: component as OpeningBalanceEvidence['component'], currencyCode: 'DZD',
  migratedAmount: amount, generalLedgerAmount: amount, evidenceReference: `GL-${component}`,
}));

describe('opening balance certification', () => {
  it('certifies the four reconciled opening components with immutable evidence checksum', () => {
    const result = certifyOpeningBalances({
      certificationId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', signedBy: 'finance-1',
      signedAt: '2026-08-30T10:00:00Z', lines,
    });
    expect(result.status).toBe('CERTIFIED');
    expect(result.lines).toHaveLength(4);
    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects any variance against the general ledger', () => {
    expect(() => certifyOpeningBalances({
      certificationId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', signedBy: 'finance-1',
      signedAt: '2026-08-30T10:00:00Z',
      lines: lines.map((line) => line.component === 'PER' ? { ...line, generalLedgerAmount: '119.99' } : line),
    })).toThrow('Opening balance variance for PER');
  });

  it('rejects an incomplete certification', () => {
    expect(() => certifyOpeningBalances({
      certificationId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', signedBy: 'finance-1',
      signedAt: '2026-08-30T10:00:00Z', lines: lines.slice(0, 3),
    })).toThrow('PAST_DISTRIBUTIONS');
  });
});
