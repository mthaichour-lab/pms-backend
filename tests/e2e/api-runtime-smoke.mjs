import { spawn } from 'node:child_process';

const port = 31_337;
const child = spawn(process.execPath, ['dist/apps/api/src/main.js'], {
  env: {
    ...process.env,
    PORT: String(port),
    OTEL_SDK_DISABLED: 'true',
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
  const exit = waitForExit(child, 2_000);
  child.kill('SIGTERM');
  const result = await exit;
  if (!result.exited) {
    child.kill('SIGKILL');
    await waitForExit(child, 2_000);
    throw new Error(`API did not exit within 2000ms after SIGTERM:\n${logs}`);
  }
  if (result.code !== null && result.code !== 0) {
    throw new Error(`API exited with code ${result.code} during shutdown:\n${logs}`);
  }
  console.log('API process exited within the shutdown deadline.');
}

async function waitFor(url) {
  // Compiled Nest startup can exceed 10s on a cold CI runner; keep the smoke
  // deterministic without weakening the endpoint assertions below.
  const deadline = Date.now() + 20_000;
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

function waitForExit(processToWatch, timeoutMs) {
  if (processToWatch.exitCode !== null || processToWatch.signalCode !== null) {
    return Promise.resolve({
      exited: true,
      code: processToWatch.exitCode,
      signal: processToWatch.signalCode,
    });
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      processToWatch.off('exit', onExit);
      resolve({ exited: false, code: null, signal: null });
    }, timeoutMs);
    const onExit = (code, signal) => {
      clearTimeout(timeout);
      resolve({ exited: true, code, signal });
    };
    processToWatch.once('exit', onExit);
  });
}
