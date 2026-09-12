import { Injectable } from '@nestjs/common';

const LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000] as const;

interface MetricSeries {
  count: number;
  durationSumMs: number;
  buckets: number[];
}

@Injectable()
export class HttpMetricsRegistry {
  private readonly series = new Map<string, MetricSeries>();

  observe(method: string, path: string, statusCode: number, durationMs: number): void {
    const normalizedMethod = /^[A-Z]{3,10}$/.test(method) ? method : 'UNKNOWN';
    const normalizedPath = normalizeMetricPath(path);
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    const key = JSON.stringify([normalizedMethod, normalizedPath, statusClass]);
    const metric = this.series.get(key) ?? { count: 0, durationSumMs: 0, buckets: LATENCY_BUCKETS.map(() => 0) };
    metric.count += 1;
    metric.durationSumMs += durationMs;
    LATENCY_BUCKETS.forEach((bucket, index) => { if (durationMs <= bucket) metric.buckets[index] += 1; });
    this.series.set(key, metric);
  }

  render(): string {
    const lines = [
      '# HELP pms_http_requests_total Completed HTTP requests.',
      '# TYPE pms_http_requests_total counter',
      '# HELP pms_http_request_duration_milliseconds HTTP request duration.',
      '# TYPE pms_http_request_duration_milliseconds histogram',
    ];
    for (const [key, metric] of [...this.series.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const [method, path, statusClass] = JSON.parse(key) as [string, string, string];
      const labels = `method="${method}",path="${escapeLabel(path)}",status_class="${statusClass}"`;
      lines.push(`pms_http_requests_total{${labels}} ${metric.count}`);
      LATENCY_BUCKETS.forEach((bucket, index) => {
        lines.push(`pms_http_request_duration_milliseconds_bucket{${labels},le="${bucket}"} ${metric.buckets[index]}`);
      });
      lines.push(`pms_http_request_duration_milliseconds_bucket{${labels},le="+Inf"} ${metric.count}`);
      lines.push(`pms_http_request_duration_milliseconds_sum{${labels}} ${metric.durationSumMs.toFixed(3)}`);
      lines.push(`pms_http_request_duration_milliseconds_count{${labels}} ${metric.count}`);
    }
    return `${lines.join('\n')}\n`;
  }
}

export function normalizeMetricPath(path: string): string {
  const pathname = path.split('?', 1)[0] || '/';
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
    .replace(/\/[0-9]{2,}(?=\/|$)/g, '/:id')
    .slice(0, 256);
}

function escapeLabel(value: string): string { return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n'); }
