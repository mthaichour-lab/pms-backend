import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { Injectable, type NestMiddleware } from '@nestjs/common';

type HttpRequest = IncomingMessage & { headers: IncomingMessage['headers'] };

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(request: HttpRequest, response: ServerResponse, next: () => void): void {
    const startedAt = process.hrtime.bigint();
    const correlationId = correlationFromHeader(request.headers['x-correlation-id']);
    response.setHeader('x-correlation-id', correlationId);
    const traceparent = singleHeader(request.headers['traceparent']);
    if (traceparent && isTraceparent(traceparent)) response.setHeader('traceparent', traceparent);
    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      console.log(JSON.stringify({
        event: 'http.request.completed',
        method: request.method,
        path: request.url?.split('?', 1)[0],
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        correlationId,
        traceparent: traceparent && isTraceparent(traceparent) ? traceparent : undefined,
      }));
    });
    next();
  }
}

export function correlationFromHeader(value: string | string[] | undefined): string {
  const candidate = singleHeader(value);
  return candidate && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isTraceparent(value: string): boolean {
  return /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/.test(value);
}
