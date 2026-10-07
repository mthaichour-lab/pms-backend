import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { SimulationsController } from '../../../apps/api/src/calculations/simulations.controller.js';
import { SolveQuotation } from '../../../src/modules/profit-calculation/application/solve-quotation.js';
import { UncertifiedQuotationBasisError } from '../../../src/modules/profit-calculation/domain/quotation-solver.js';

describe('SimulationsController', () => {
  it('maps an uncertified quotation basis to an explicit conflict instead of HTTP 500', async () => {
    const controller = new SimulationsController(new SolveQuotation({
      loadCertifiedInputs: async () => { throw new UncertifiedQuotationBasisError(); },
    }));

    try {
      await controller.solve({ placementAmount: '1000', targetNetRatePercent: '4', basis: { type: 'GLOBAL_POOL' } });
      throw new Error('Expected quotation conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'UNCERTIFIED_BASIS', requiredAction: 'CERTIFY_POOL_RESULT',
      });
    }
  });
});
