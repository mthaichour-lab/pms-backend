import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from '../../../apps/api/src/app/health.controller.js';

describe('HealthController', () => {
  it('keeps startup and liveness independent from PostgreSQL', () => {
    const controller = new HealthController({ readiness: vi.fn(async () => { throw new Error('database secret must not leak'); }) });
    expect(controller.startup()).toEqual({ status: 'started' });
    expect(controller.live()).toEqual({ status: 'alive' });
  });

  it('reports readiness only after a successful PostgreSQL probe', async () => {
    const readiness = vi.fn(async () => undefined);
    await expect(new HealthController({ readiness }).ready()).resolves.toEqual({ status: 'ready', checks: { postgres: 'up' } });
    expect(readiness).toHaveBeenCalledOnce();
  });

  it('returns a sanitized 503 when PostgreSQL is unavailable', async () => {
    const controller = new HealthController({ readiness: vi.fn(async () => { throw new Error('postgresql://user:secret@db/pms'); }) });
    const rejection = controller.ready();
    await expect(rejection).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(rejection).rejects.toMatchObject({ status: 503, response: { status: 'unavailable', checks: { postgres: 'down' } } });
  });
});
