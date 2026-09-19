import { describe, expect, it, vi } from 'vitest';

import { ManageSecureExport } from '../../../src/modules/reporting/application/manage-secure-export.js';

const correlationId = '65aeb69d-73a7-4f04-9578-5fa8326f654f';

describe('ManageSecureExport validation', () => {
  it('normalizes requester, key and filter ordering before persistence', async () => {
    const create = vi.fn(async () => ({ exportId: '7dcc813a-4cb9-4b38-a49d-bbb7fd15330e', status: 'APPROVED' as const }));
    const service = new ManageSecureExport({ create, approve: vi.fn(), generate: vi.fn() });
    await service.create({
      reportType: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE', requesterId: ' maker ',
      idempotencyKey: ' export-create-0001 ', correlationId: ` ${correlationId.toUpperCase()} `,
      filters: { zeta: '2', alpha: '1' },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      requesterId: 'maker', idempotencyKey: 'export-create-0001',
      correlationId,
      filters: { alpha: '1', zeta: '2' },
    }), 'APPROVED');
  });

  it('rejects malformed UUIDs and oversized idempotency keys', () => {
    const service = new ManageSecureExport({ create: vi.fn(), approve: vi.fn(), generate: vi.fn() });
    expect(() => service.approve('------------------------------------', 'checker', 'approval-action-001', correlationId))
      .toThrow('Export identifier');
    expect(() => service.generate(
      '7dcc813a-4cb9-4b38-a49d-bbb7fd15330e', 'maker',
      { columns: [{ key: 'amount', label: 'Amount' }], rows: [{ amount: 1 }] }, 'x'.repeat(129), correlationId,
    )).toThrow('between 16 and 128');
    expect(() => service.create({
      reportType: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE', requesterId: 'maker',
      idempotencyKey: 'export key with spaces', correlationId,
    })).toThrow('between 16 and 128');
  });

  it('rejects a missing or malformed correlation identifier before persistence', () => {
    const create = vi.fn();
    const service = new ManageSecureExport({ create, approve: vi.fn(), generate: vi.fn() });
    expect(() => service.create({
      reportType: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE', requesterId: 'maker',
      idempotencyKey: 'export-create-0001', correlationId: '',
    })).toThrow('correlation identifier must be a UUID');
    expect(create).not.toHaveBeenCalled();
  });
});
