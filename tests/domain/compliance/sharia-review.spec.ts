import { describe, expect, it } from 'vitest';
import { decideShariaCase, reviewShariaCase } from '../../../src/modules/compliance/domain/sharia-review.js';

describe('Sharia review', () => {
  it('enforces three distinct actors and documentary evidence', () => {
    const reviewed = reviewShariaCase({ state: 'SUBMITTED', makerId: 'maker' }, 'reviewer', 'Avis Charia favorable');
    const decided = decideShariaCase(
      reviewed, 'approver', 'APPROVED', 'Décision conforme et contrôlée',
      '17146c36-a0cb-4e0a-b095-60b67c945eb9',
    );
    expect(decided.state).toBe('APPROVED');
    expect(decided.evidenceDocumentId).toBeDefined();
  });

  it('forbids the maker from reviewing their own case', () => {
    expect(() => reviewShariaCase(
      { state: 'SUBMITTED', makerId: 'same' }, 'same', 'Avis Charia favorable',
    )).toThrow('Maker cannot review');
  });
});
