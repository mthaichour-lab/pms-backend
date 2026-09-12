import { describe, expect, it } from 'vitest';

import { correlationFromHeader } from '../../../apps/api/src/observability/correlation.middleware.js';

describe('correlation middleware', () => {
  it('preserves a valid upstream correlation identifier', () => {
    const correlationId = '65aeb69d-73a7-4f04-9578-5fa8326f654f';
    expect(correlationFromHeader(correlationId)).toBe(correlationId);
  });

  it.each(['run-2026:operation_7', 'unsafe header\nvalue'])('replaces a non-UUID value with a UUID', (value) => {
    expect(correlationFromHeader(value)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
