import { cp, mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const target = 'homologation/parallel-run/.fixture-results';

async function runGate(signoffFixture) {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  for (const name of ['campaign.json', 'pms-results.json', 'manual-results.json']) {
    await cp(`homologation/parallel-run/fixtures/${name}`, `${target}/${name}`);
  }
  await cp(`homologation/parallel-run/fixtures/${signoffFixture}`, `${target}/signoffs.json`);
  return new Promise((resolve) =>
    spawn(process.execPath, ['homologation/parallel-run/evaluate-parallel-run.mjs', target], { stdio: 'inherit' }).once('exit', resolve),
  );
}

try {
  const passingCode = await runGate('signoffs.json');
  if (passingCode !== 0) throw new Error('Three valid signoffs must authorize the progressive switch');
  const blockingCode = await runGate('signoffs-missing-audit.json');
  if (blockingCode === 0) throw new Error('A missing Audit signoff must block the progressive switch');
} finally {
  await rm(target, { recursive: true, force: true });
}
