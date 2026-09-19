import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const evidencePath = 'deploy/dr/results/latest-failover-drill.json';

describe('DR failover drill local simulation', () => {
  it('proves watermark, failover, readiness and RPO/RTO without external endpoints', async () => {
    let watermarkCalls = 0;
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      if (request.url === '/internal/dr/watermark') {
        watermarkCalls += 1;
        const before = watermarkCalls % 2 === 1;
        response.end(JSON.stringify({ watermark: before ? `source-${watermarkCalls}` : `recovered-${watermarkCalls}`, committedAt: before ? '2026-09-19T16:00:00.000Z' : '2026-09-19T16:00:01.000Z' }));
        return;
      }
      if (request.url === '/internal/dr/failover' && request.method === 'POST') { response.statusCode = 202; response.end(JSON.stringify({ accepted: true })); return; }
      if (request.url === '/health/ready') { response.end(JSON.stringify({ status: 'ready' })); return; }
      response.statusCode = 404; response.end(JSON.stringify({ error: 'not found' }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Local DR server did not bind');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const secret = 'local-only-control-token';
    try {
      const result = await run(process.execPath, ['deploy/dr/run-failover-drill.mjs'], {
        env: { ...process.env, DR_MODE: 'ISOLATED_RESTORE_TEST', DR_CONTROL_TOKEN: secret, CORE_DR_URL: baseUrl, TOKEN_VAULT_DR_URL: baseUrl, DR_RPO_TARGET_MS: '300000', DR_RTO_TARGET_MS: '3600000' },
      });
      expect(result.stdout).not.toContain(secret);
      const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
      expect(evidence.passed).toBe(true);
      expect(evidence.services).toHaveLength(2);
      expect(evidence.services.every((service: { rpoMs: number; rtoMs: number }) => service.rpoMs <= 300000 && service.rtoMs <= 3600000)).toBe(true);
    } finally {
      await rm(evidencePath, { force: true });
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
