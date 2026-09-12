import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RegulatoryReferenceController } from '../../../apps/api/src/reference-data/regulatory-reference.controller.js';
import { GetEffectiveRegulatoryRule } from '../../../src/modules/reference-data/application/regulatory-reference.js';

const rule = {
  ruleCode: 'BA.PROFIT_SHARE', version: 1, authority: 'BANK_OF_ALGERIA' as const,
  legalReference: 'Instruction BA 2026-01', effectiveFrom: '2026-01-01', parameters: { roundingMode: 'HALF_EVEN' },
};

describe('RegulatoryReferenceController', () => {
  it('exposes the rule supplied through the ReferenceData port', async () => {
    const controller = new RegulatoryReferenceController(new GetEffectiveRegulatoryRule({ findEffectiveRegulatoryRule: async () => rule }));
    await expect(controller.getEffectiveRule('BA.PROFIT_SHARE', '2026-08-29')).resolves.toEqual(rule);
  });

  it('maps invalid input and missing rules to HTTP client errors', async () => {
    const controller = new RegulatoryReferenceController(new GetEffectiveRegulatoryRule({ findEffectiveRegulatoryRule: async () => undefined }));
    await expect(controller.getEffectiveRule('invalid', '2026-08-29')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getEffectiveRule('BA.PROFIT_SHARE', '2026-08-29')).rejects.toBeInstanceOf(NotFoundException);
  });
});
