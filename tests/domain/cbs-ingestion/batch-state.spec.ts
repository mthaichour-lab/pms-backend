import { describe, expect, it } from 'vitest';

import { assertBatchTransition } from '../../../src/modules/cbs-ingestion/domain/batch-state.js';

describe('CBS batch state machine', () => {
  it('allows the controlled nominal publication path', () => {
    expect(() => assertBatchTransition('RECEIVED', 'SCANNED')).not.toThrow();
    expect(() => assertBatchTransition('APPROVED', 'PUBLISHED')).not.toThrow();
  });

  it('prevents publication before approval and mutation after publication', () => {
    expect(() => assertBatchTransition('RECEIVED', 'PUBLISHED')).toThrow('Invalid');
    expect(() => assertBatchTransition('PUBLISHED', 'FAILED')).toThrow('Invalid');
  });
});
