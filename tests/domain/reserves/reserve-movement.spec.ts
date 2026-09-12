import { describe, expect, it } from 'vitest';

import { authorizeReserveMovement, calculateReserveMovement } from '../../../src/modules/reserves/domain/reserve-movement.js';

describe('reserve continuity', () => {
  it('maintains exact PER opening/movement/closing continuity', () => {
    expect(calculateReserveMovement({
      reserveType: 'PER', kind: 'FUND', openingBalance: '10.10',
      movementAmount: '0.20', currency: 'DZD', scale: 2,
    }).closingBalance).toBe('10.30');
  });

  it('prevents an IRR utilization from making the reserve negative', () => {
    expect(() => calculateReserveMovement({
      reserveType: 'IRR', kind: 'UTILIZE', openingBalance: '1.00',
      movementAmount: '-1.01', currency: 'DZD', scale: 2,
    })).toThrow('negative');
  });
});

describe('reserve governance', () => {
  const base = {
    poolId: 'POOL-001', reserveType: 'PER' as const, kind: 'RELEASE' as const,
    openingBalance: '100.00', movementAmount: '-20.00', currency: 'DZD', scale: 2,
    investorOpeningBalance: '70.00', bankOpeningBalance: '30.00',
    investorMovementAmount: '-14.00', bankMovementAmount: '-6.00',
    minimumBalance: '50.00', maximumBalance: '200.00', approvalThreshold: '10.00',
  };

  it('exige une approbation explicite au-delà du seuil', () => {
    expect(() => authorizeReserveMovement(base)).toThrow('requires explicit approval');
    expect(authorizeReserveMovement({ ...base, approvalId: 'approval-reserve-0001' })).toMatchObject({
      closingBalance: '80.00', investorClosingBalance: '56.00', bankClosingBalance: '24.00', approvalRequired: true,
    });
  });

  it('conserve séparément les quotes-parts banque et investisseurs', () => {
    expect(() => authorizeReserveMovement({ ...base, movementAmount: '-5.00', investorMovementAmount: '-5.00', bankMovementAmount: '-1.00' }))
      .toThrow('movement shares must equal');
  });
});
