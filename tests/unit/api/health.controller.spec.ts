import { describe, expect, it } from 'vitest';

import { HealthController } from '../../../apps/api/src/app/health.controller.js';

describe('HealthController', () => {
  const controller = new HealthController();

  it('exposes distinct startup, readiness and liveness states', () => {
    expect(controller.startup()).toEqual({ status: 'started' });
    expect(controller.ready()).toEqual({ status: 'ready' });
    expect(controller.live()).toEqual({ status: 'alive' });
  });
});
