import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const rpoTargetMs = boundedNumber('DR_RPO_TARGET_MS', 300_000, 300_000);
const rtoTargetMs = boundedNumber('DR_RTO_TARGET_MS', 3_600_000, 3_600_000);
const mode = process.env.DR_MODE ?? 'ISOLATED_RESTORE_TEST';
if (mode !== 'ISOLATED_RESTORE_TEST') throw new Error('DR_MODE must be ISOLATED_RESTORE_TEST');
const token = process.env.DR_CONTROL_TOKEN;
if (!token) throw new Error('DR_CONTROL_TOKEN is required');
const services = [service('core', 'CORE_DR_URL'), service('token-vault', 'TOKEN_VAULT_DR_URL')];
const results = [];
for (const target of services) results.push(await exercise(target));
const evidence = { story: '14.2', exerciseId: crypto.randomUUID(), executedAt: new Date().toISOString(), mode, targets: { rpoMs: rpoTargetMs, rtoMs: rtoTargetMs }, services: results, passed: results.every((result) => result.passed), nextTechnicalRestoreDueAt: addMonths(3), nextFullDrDueAt: addMonths(12) };
await mkdir('deploy/dr/results', { recursive: true });
await writeFile('deploy/dr/results/latest-failover-drill.json', `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
if (!evidence.passed) process.exitCode = 1;

async function exercise(target) {
  const before = await request(`${target.url}/internal/dr/watermark`, {}, 10_000);
  const started = performance.now();
  await request(`${target.url}/internal/dr/failover`, { method: 'POST', body: JSON.stringify({ mode, sourceWatermark: before.watermark }) }, 10_000);
  let ready; let lastError;
  const deadline = Date.now() + rtoTargetMs;
  while (Date.now() < deadline) {
    try { const health = await request(`${target.url}/health/ready`, {}, Math.min(10_000, Math.max(1, deadline - Date.now()))); if (health.status === 'ready' || health.ready === true) { ready = health; break; } }
    catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  const rtoMs = performance.now() - started;
  if (!ready) throw new Error(`${target.name} did not recover: ${lastError?.message ?? 'RTO deadline exceeded'}`);
  const remaining = Math.max(1, rtoTargetMs - (performance.now() - started));
  const after = await request(`${target.url}/internal/dr/watermark`, {}, Math.min(10_000, remaining));
  const sourceAt = Date.parse(before.committedAt); const recoveredAt = Date.parse(after.committedAt);
  if (!Number.isFinite(sourceAt) || !Number.isFinite(recoveredAt)) throw new Error(`${target.name} returned invalid DR watermark timestamps`);
  const rpoMs = Math.max(0, sourceAt - recoveredAt);
  return { name: target.name, sourceWatermark: before.watermark, recoveredWatermark: after.watermark, rpoMs, rtoMs: Number(rtoMs.toFixed(2)), rpoTargetMs, rtoTargetMs, passed: rpoMs <= rpoTargetMs && rtoMs <= rtoTargetMs };
}
async function request(url, init = {}, timeoutMs = 10_000) { const timeout = Math.max(1, Math.min(timeoutMs, 10_000)); const response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeout), headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } }); if (!response.ok) throw new Error(`${url} returned ${response.status}`); return response.json(); }
function service(name, key) { const url = process.env[key]; if (!url) throw new Error(`${key} is required`); return { name, url: url.replace(/\/$/, '') }; }
function boundedNumber(name, fallback, maximum) { const value = Number(process.env[name] ?? fallback); if (!Number.isFinite(value) || value <= 0 || value > maximum) throw new Error(`${name} must be between 1 and ${maximum}ms`); return value; }
function addMonths(months) { const date = new Date(); date.setUTCMonth(date.getUTCMonth() + months); return date.toISOString(); }
