import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuditController } from '../../../apps/api/src/audit/audit.controller.js';
import { QueryAuditTrail } from '../../../src/modules/audit/application/query-audit-trail.js';

describe('AuditController', () => {
  it('uses the bounded default window', async () => {
    const latestWindow = vi.fn().mockResolvedValue({ events: [], matches: [], predecessorExists: [] });
    const append = vi.fn().mockResolvedValue({});
    const controller = new AuditController(new QueryAuditTrail({ latestWindow }), { append } as never);

    await expect(controller.latest({}, '65aeb69d-73a7-4f04-9578-5fa8326f654f', { sub: 'auditor-1' })).resolves.toMatchObject({ chainValid: true, verifiedCount: 0 });
    expect(latestWindow).toHaveBeenCalledWith(50, expect.objectContaining({}));
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
      actorId: 'auditor-1',
      action: 'READ_AUDIT_TRAIL',
      outcome: 'SUCCESS',
    }));
  });

  it('maps an invalid query limit to a client error', async () => {
    const controller = new AuditController(new QueryAuditTrail({ latestWindow: async () => ({ events: [], matches: [], predecessorExists: [] }) }), { append: async () => ({}) } as never);
    const user = { sub: 'auditor-1' };
    const invoke = (limit: string, action?: string) => controller.latest({ limit, action }, undefined, user);
    await expect(invoke('not-an-integer')).rejects.toBeInstanceOf(BadRequestException);
    await expect(invoke('0x10')).rejects.toBeInstanceOf(BadRequestException);
    await expect(invoke('1e2')).rejects.toBeInstanceOf(BadRequestException);
    await expect(invoke('201')).rejects.toBeInstanceOf(BadRequestException);
    await expect(invoke('25', 'bad action')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes validated audit filters to the query use case', async () => {
    const latestWindow = vi.fn().mockResolvedValue({ events: [], matches: [], predecessorExists: [] }); const append = vi.fn().mockResolvedValue({});
    const controller = new AuditController(new QueryAuditTrail({ latestWindow }), { append } as never);
    await controller.latest({ limit: '25', action: 'APPROVE_CALCULATION', resourceType: 'CalculationRun', outcome: 'SUCCESS', correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f', businessDateFrom: '2026-09-01', businessDateTo: '2026-09-09' }, '4555b25c-8f2a-4623-874f-013420c81b4d', { sub: 'auditor-1' });
    expect(latestWindow).toHaveBeenCalledWith(250, { action: 'APPROVE_CALCULATION', resourceType: 'CalculationRun', outcome: 'SUCCESS', correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f', businessDateFrom: '2026-09-01', businessDateTo: '2026-09-09' });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      authorizedChanges: { filters: expect.objectContaining({ action: 'APPROVE_CALCULATION', outcome: 'SUCCESS' }) },
    }));
  });
});
