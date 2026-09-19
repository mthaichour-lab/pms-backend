import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const mode = process.env.DR_MODE;
if (!mode) fail('DR_MODE is required and must be ISOLATED_RESTORE_TEST');
if (mode !== 'ISOLATED_RESTORE_TEST') fail('DR_MODE must be ISOLATED_RESTORE_TEST');
requiredSecret('DR_CONTROL_TOKEN');
requiredUrl('CORE_DR_URL');
requiredUrl('TOKEN_VAULT_DR_URL');
bounded('DR_RPO_TARGET_MS', 300_000, 300_000);
bounded('DR_RTO_TARGET_MS', 3_600_000, 3_600_000);

try {
  await exec('docker', ['info', '--format', '{{.ServerVersion}}'], { windowsHide: true });
} catch {
  fail('Docker daemon is unavailable; start Docker before running the DR drill');
}

console.log('DR preflight passed: isolated mode, protected configuration, RPO/RTO limits and Docker are available.');

function requiredSecret(name) {
  if (!process.env[name]?.trim()) fail(`${name} is required (value is never displayed)`);
}
function requiredUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required`);
  try { const parsed = new URL(value); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); }
  catch { fail(`${name} must be an absolute HTTP(S) URL`); }
}
function bounded(name, fallback, maximum) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) fail(`${name} must be an integer between 1 and ${maximum}`);
}
function fail(message) { console.error(`DR preflight failed: ${message}`); process.exit(1); }
