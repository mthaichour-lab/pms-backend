import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = process.argv[2] ?? 'homologation/parallel-run/results';
const read = async (name) =>
  JSON.parse(await readFile(join(directory, name), 'utf8'));

const [campaign, pms, manual, signoffs] = await Promise.all([
  read('campaign.json'),
  read('pms-results.json'),
  read('manual-results.json'),
  read('signoffs.json'),
]);

function toMinorUnits(value) {
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error(`Invalid monetary amount: ${value}`);
  return BigInt(`${match[1]}${match[2]}${(match[3] ?? '').padEnd(2, '0')}`);
}

function index(records, source) {
  const result = new Map();
  for (const record of records) {
    const key = `${record.accountReference}|${record.currency}`;
    if (result.has(key)) throw new Error(`Duplicate ${source} result: ${key}`);
    result.set(key, record);
  }
  return result;
}

const pmsByKey = index(pms.results ?? [], 'PMS');
const manualByKey = index(manual.results ?? [], 'manual');
const keys = [...new Set([...pmsByKey.keys(), ...manualByKey.keys()])].sort();
const differences = keys.flatMap((key) => {
  const pmsRecord = pmsByKey.get(key);
  const manualRecord = manualByKey.get(key);
  if (!pmsRecord || !manualRecord) {
    return [{ key, type: 'MISSING_RESULT', pms: pmsRecord ?? null, manual: manualRecord ?? null }];
  }
  const delta = toMinorUnits(pmsRecord.amount) - toMinorUnits(manualRecord.amount);
  if (delta === 0n) return [];
  return [{ key, type: 'AMOUNT_DELTA', pmsAmount: pmsRecord.amount, manualAmount: manualRecord.amount, deltaMinorUnits: delta.toString() }];
});

const requiredRoles = ['FINANCE', 'SHARIA', 'AUDIT'];
const approvedRoles = new Set(
  (signoffs.signoffs ?? [])
    .filter((signoff) => signoff.decision === 'APPROVED' && signoff.signedAt && signoff.signedBy)
    .map((signoff) => signoff.role),
);
const missingApprovals = requiredRoles.filter((role) => !approvedRoles.has(role));
const blockers = [];
if (!campaign.periodStart || !campaign.periodEnd) blockers.push('PARALLEL_PERIOD_UNDEFINED');
if (campaign.legacyToolStatus !== 'ACTIVE') blockers.push('LEGACY_TOOL_NOT_ACTIVE');
if (missingApprovals.length) blockers.push('MISSING_REQUIRED_SIGNOFFS');

const report = {
  story: '14.4',
  campaignReference: campaign.reference,
  period: { start: campaign.periodStart, end: campaign.periodEnd },
  generatedAt: new Date().toISOString(),
  comparedRecordCount: keys.length,
  differenceCount: differences.length,
  differences,
  requiredRoles,
  missingApprovals,
  legacyToolStatus: campaign.legacyToolStatus,
  blockers,
  progressiveSwitchDecision: blockers.length === 0 ? 'AUTHORIZED' : 'BLOCKED',
};

await mkdir(directory, { recursive: true });
await writeFile(join(directory, 'parallel-run-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (blockers.length) process.exitCode = 1;
