import { readFile } from 'node:fs/promises';

const evidence = JSON.parse(await readFile(process.argv[2] ?? 'deploy/dr/results/latest-failover-drill.json', 'utf8'));
const failures = [];
if (evidence.story !== '14.2') failures.push('wrong story');
if (evidence.mode !== 'ISOLATED_RESTORE_TEST') failures.push('DR evidence is not isolated restore mode');
if (evidence.targets?.rpoMs > 300_000) failures.push('RPO target exceeds the 5 minute control');
if (evidence.targets?.rtoMs > 3_600_000) failures.push('RTO target exceeds the 60 minute control');
if (JSON.stringify(evidence).match(/(?:password|secret|token|authorization|bearer)\s*[:=]/i)) failures.push('DR evidence contains a secret-like field');
for (const name of ['core', 'token-vault']) {
  const result = evidence.services?.find((item) => item.name === name);
  if (!result) failures.push(`missing ${name}`);
  else {
    if (result.rpoMs > 300_000) failures.push(`${name} RPO exceeded`);
    if (result.rtoMs > 3_600_000) failures.push(`${name} RTO exceeded`);
    if (!result.sourceWatermark || !result.recoveredWatermark) failures.push(`${name} watermark missing`);
  }
}
if (!evidence.nextTechnicalRestoreDueAt || !evidence.nextFullDrDueAt) failures.push('periodic replay dates missing');
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('Core and Token Vault failover evidence satisfies isolated mode, RPO/RTO and periodic replay controls.');
