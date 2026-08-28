import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ReferenceDataController } from '../../../apps/api/src/reference-data/reference-data.controller.js';
import { GetEffectiveCurrency } from '../../../src/modules/reference-data/application/currency-reference.js';

describe('ReferenceDataController', () => {
  const controller = new ReferenceDataController(new GetEffectiveCurrency({
    findEffective: async (code, businessDate) => code === 'DZD' ? {
      code, name: 'Algerian dinar', fractionDigits: 2, validFrom: businessDate,
    } : undefined,
  }));

  it('returns the effective currency at the requested business date', async () => {
    await expect(controller.getCurrency('DZD', '2026-08-28')).resolves.toMatchObject({ code: 'DZD' });
  });

  it('normalizes invalid and missing references into HTTP errors', async () => {
    await expect(controller.getCurrency('dzd', '2026-08-28')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getCurrency('EUR', '2026-08-28')).rejects.toBeInstanceOf(NotFoundException);
  });
});
