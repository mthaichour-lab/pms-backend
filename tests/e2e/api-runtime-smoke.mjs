import { spawn } from 'node:child_process';

const port = 31_337;
const child = spawn(process.execPath, ['dist/apps/api/src/main.js'], {
  env: {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:9/pms',
    OIDC_ISSUER: 'http://127.0.0.1:9/realms/smoke',
    KMS_URL: 'http://127.0.0.1:9',
    KMS_AUDIT_KEY_ID: 'smoke-audit-key',
    KMS_WORKLOAD_TOKEN: 'smoke-only-token',
    TOKEN_VAULT_URL: 'http://127.0.0.1:9',
    TOKEN_VAULT_WORKLOAD_TOKEN: 'smoke-only-token',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
child.stderr.on('data', (chunk) => { logs += chunk.toString(); });

try {
  await waitFor(`http://127.0.0.1:${port}/api/health/startup`);
  const liveResponse = await fetch(`http://127.0.0.1:${port}/api/health/live`);
  if (!liveResponse.ok || (await liveResponse.json()).status !== 'alive') throw new Error('liveness probe did not remain independent');
  // DATABASE_URL targets a closed local port: this is the smoke database failure stub.
  const readyResponse = await fetch(`http://127.0.0.1:${port}/api/health/ready`);
  if (readyResponse.status !== 503) throw new Error(`readiness failure stub returned ${readyResponse.status}`);
  const readiness = await readyResponse.json();
  if (readiness.status !== 'unavailable' || readiness.checks?.postgres !== 'down' || JSON.stringify(readiness).includes('smoke:smoke')) {
    throw new Error('readiness failure response was not sanitized');
  }
  const metricsResponse = await fetch(`http://127.0.0.1:${port}/api/metrics`);
  if (!metricsResponse.ok) throw new Error(`metrics endpoint returned ${metricsResponse.status}`);
  if (!metricsResponse.headers.get('content-type')?.includes('text/plain')) {
    throw new Error('metrics endpoint did not return Prometheus text');
  }
  const metrics = await metricsResponse.text();
  if (!metrics.includes('pms_http_requests_total')) {
    throw new Error('metrics endpoint did not expose HTTP request counters');
  }
  console.log('Compiled API started; independent liveness, database readiness failure and Prometheus metrics passed.');
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

async function waitFor(url) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited before startup:\n${logs}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* startup race */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API startup timed out:\n${logs}`);
}
