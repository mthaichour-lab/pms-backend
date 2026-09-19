import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SecureExportController } from '../../../apps/api/src/reporting/secure-export.controller.js';
import { ManageSecureExport } from '../../../src/modules/reporting/application/manage-secure-export.js';

const exportId = '7dcc813a-4cb9-4b38-a49d-bbb7fd15330e';
const correlationId = '65aeb69d-73a7-4f04-9578-5fa8326f654f';
const claims = { sub: 'maker' };

function controllerWith(repository: ConstructorParameters<typeof ManageSecureExport>[0]) {
  return new SecureExportController(new ManageSecureExport(repository));
}

describe('SecureExportController', () => {
  it('propagates authenticated identity and correlation to creation', async () => {
    const create = vi.fn().mockResolvedValue({ exportId, status: 'APPROVED' });
    const controller = controllerWith({ create, approve: vi.fn(), generate: vi.fn() });
    await expect(controller.create(
      { reportType: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE' },
      'export-create-0001', correlationId, claims,
    )).resolves.toEqual({ exportId, status: 'APPROVED' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 'maker', correlationId }), 'APPROVED');
  });

  it('rejects a missing correlation identifier before persistence', async () => {
    const approve = vi.fn();
    const controller = controllerWith({ create: vi.fn(), approve, generate: vi.fn() });
    await expect(controller.approve(exportId, 'export-approve-001', undefined, claims))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(approve).not.toHaveBeenCalled();
  });
});
