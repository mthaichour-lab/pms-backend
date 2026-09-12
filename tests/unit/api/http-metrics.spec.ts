import { describe, expect, it } from 'vitest';
import { HttpMetricsRegistry, normalizeMetricPath } from '../../../apps/api/src/observability/http-metrics.js';

describe('HTTP metrics', () => {
  it('bounds cardinality by replacing identifiers', () => {
    expect(normalizeMetricPath('/api/calculations/17146c36-a0cb-4e0a-b095-60b67c945eb9')).toBe('/api/calculations/:id');
    expect(normalizeMetricPath('/api/items/12345')).toBe('/api/items/:id');
  });

  it('renders counters and cumulative latency buckets in Prometheus format', () => {
    const metrics = new HttpMetricsRegistry();
    metrics.observe('GET', '/api/health/live', 200, 12);
    metrics.observe('GET', '/api/health/live', 204, 30);
    const output = metrics.render();
    expect(output).toContain('pms_http_requests_total{method="GET",path="/api/health/live",status_class="2xx"} 2');
    expect(output).toContain('le="25"} 1');
    expect(output).toContain('le="+Inf"} 2');
  });
});
