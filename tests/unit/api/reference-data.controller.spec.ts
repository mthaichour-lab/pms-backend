import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ReferenceDataController } from '../../../apps/api/src/reference-data/reference-data.controller.js';
import { GetEffectiveCurrency, ManageCurrencyReference } from '../../../src/modules/reference-data/application/currency-reference.js';

describe('ReferenceDataController', () => {
  const controller = new ReferenceDataController(new GetEffectiveCurrency({
    findEffective: async (code, businessDate) => code === 'DZD' ? {
      code, name: 'Algerian dinar', fractionDigits: 2, validFrom: businessDate,
    } : undefined,
  }), new ManageCurrencyReference({
    findEffective: async () => undefined,
    listEffective: async (businessDate, limit, offset) => ({ items: [{ code: 'DZD', name: 'Algerian dinar', fractionDigits: 2, validFrom: businessDate }], total: limit + offset - limit - offset + 1 }),
    saveVersion: async (currency) => currency,
  }));

  it('returns the effective currency at the requested business date', async () => {
    await expect(controller.getCurrency('DZD', '2026-08-28')).resolves.toMatchObject({ code: 'DZD' });
  });

  it('normalizes invalid and missing references into HTTP errors', async () => {
    await expect(controller.getCurrency('dzd', '2026-08-28')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getCurrency('EUR', '2026-08-28')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists the effective currency catalog and keeps reference creation validated', async () => {
    await expect(controller.listCurrencies('2026-08-28', '25', '0')).resolves.toMatchObject({ total: 1, items: [{ code: 'DZD' }] });
    await expect(controller.createCurrency({ code: 'EUR', name: 'Euro', fractionDigits: 2, validFrom: '2026-08-28' }, { sub: 'admin' } as never)).resolves.toMatchObject({ code: 'EUR' });
    await expect(controller.listCurrencies('2026-08-28', '101', '0')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.createCurrency({ code: 'eur', name: 'Euro', fractionDigits: 2, validFrom: '2026-08-28' }, { sub: 'admin' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});
