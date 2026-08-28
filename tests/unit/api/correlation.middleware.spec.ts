import { describe, expect, it } from 'vitest';

import { correlationFromHeader } from '../../../apps/api/src/observability/correlation.middleware.js';

describe('correlation middleware', () => {
  it('preserves a valid upstream correlation identifier', () => {
    expect(correlationFromHeader('run-2026:operation_7')).toBe('run-2026:operation_7');
  });

  it('replaces unsafe values with a UUID', () => {
    expect(correlationFromHeader('unsafe header\nvalue')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
