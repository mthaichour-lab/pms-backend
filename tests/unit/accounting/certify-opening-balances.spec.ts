import { describe, expect, it, vi } from 'vitest';
import { CertifyOpeningBalances } from '../../../src/modules/accounting/application/certify-opening-balances.js';

describe('CertifyOpeningBalances', () => {
  it('persists only a complete Finance certification', async () => {
    const save = vi.fn().mockResolvedValue({ status: 'CERTIFIED' });
    const service = new CertifyOpeningBalances({ save });
    await expect(service.execute({
      certificationId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', signedBy: 'finance-1', signedAt: '2026-08-30T10:00:00Z', correlationId: '550e8400-e29b-41d4-a716-446655440001',
      lines: ['HISTORICAL_ACCOUNTS', 'PER', 'IRR', 'PAST_DISTRIBUTIONS'].map((component) => ({
        component: component as 'HISTORICAL_ACCOUNTS'|'PER'|'IRR'|'PAST_DISTRIBUTIONS', currencyCode: 'DZD',
        migratedAmount: '10', generalLedgerAmount: '10', evidenceReference: `EVIDENCE-${component}`,
      })),
    })).resolves.toEqual({ status: 'CERTIFIED' });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: 'CERTIFIED' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ correlationId: '550e8400-e29b-41d4-a716-446655440001' }));
  });

  it('rejects malformed correlation before persistence', () => {
    const save = vi.fn();
    const service = new CertifyOpeningBalances({ save });
    expect(() => service.execute({
      certificationId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', signedBy: 'finance-1', signedAt: '2026-08-30T10:00:00Z', correlationId: 'invalid', lines: [],
    })).toThrow('correlation identifier');
    expect(save).not.toHaveBeenCalled();
  });
});
