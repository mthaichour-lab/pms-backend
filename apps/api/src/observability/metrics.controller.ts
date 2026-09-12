import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { HttpMetricsRegistry } from './http-metrics.js';

@Controller('metrics')
@Public()
export class MetricsController {
  constructor(private readonly metrics: HttpMetricsRegistry) {}

  @Get()
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string { return this.metrics.render(); }
}
