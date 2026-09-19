import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const script = 'deploy/dr/preflight.mjs';

describe('DR preflight', () => {
  it('requires DR_MODE explicitly before checking protected configuration', async () => {
    await expect(run(process.execPath, [script], {
      env: { ...process.env, DR_MODE: '', DR_CONTROL_TOKEN: 'secret', CORE_DR_URL: 'https://core.example', TOKEN_VAULT_DR_URL: 'https://vault.example' },
    })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('DR_MODE is required') });
  });

  it('fails explicitly without exposing the control token', async () => {
    const token = 'super-secret-control-token';
    await expect(run(process.execPath, [script], {
      env: { ...process.env, DR_MODE: 'ISOLATED_RESTORE_TEST', DR_CONTROL_TOKEN: token, CORE_DR_URL: '', TOKEN_VAULT_DR_URL: 'https://vault.example' },
    })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('CORE_DR_URL is required'),
    });
    try {
      await run(process.execPath, [script], { env: { ...process.env, DR_MODE: 'ISOLATED_RESTORE_TEST', DR_CONTROL_TOKEN: token, CORE_DR_URL: '', TOKEN_VAULT_DR_URL: 'https://vault.example' } });
    } catch (error) {
      expect(String(error)).not.toContain(token);
    }
  });

  it('rejects a target above the five-minute RPO control', async () => {
    await expect(run(process.execPath, [script], {
      env: { ...process.env, DR_MODE: 'ISOLATED_RESTORE_TEST', DR_CONTROL_TOKEN: 'secret', CORE_DR_URL: 'https://core.example', TOKEN_VAULT_DR_URL: 'https://vault.example', DR_RPO_TARGET_MS: '300001' },
    })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('DR_RPO_TARGET_MS') });
  });
});
