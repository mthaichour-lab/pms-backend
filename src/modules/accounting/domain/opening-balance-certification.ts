import { Decimal } from 'decimal.js';
import { createHash } from 'node:crypto';

export const openingBalanceComponents = [
  'HISTORICAL_ACCOUNTS', 'PER', 'IRR', 'PAST_DISTRIBUTIONS',
] as const;
export type OpeningBalanceComponent = typeof openingBalanceComponents[number];

export interface OpeningBalanceEvidence {
  component: OpeningBalanceComponent;
  currencyCode: string;
  migratedAmount: string;
  generalLedgerAmount: string;
  evidenceReference: string;
}

export function certifyOpeningBalances(input: {
  certificationId: string;
  signedBy: string;
  signedAt: string;
  correlationId?: string;
  lines: readonly OpeningBalanceEvidence[];
}) {
  if (!input.signedBy.trim()) throw new TypeError('Finance signer is required');
  if (Number.isNaN(Date.parse(input.signedAt))) throw new TypeError('Finance signature timestamp is invalid');
  if (input.correlationId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.correlationId.trim())) {
    throw new TypeError('Opening balance correlation identifier must be a UUID');
  }
  const seen = new Set<OpeningBalanceComponent>();
  const lines = input.lines.map((line) => {
    if (seen.has(line.component)) throw new TypeError(`Duplicate opening balance component: ${line.component}`);
    seen.add(line.component);
    if (!/^[A-Z]{3}$/.test(line.currencyCode)) throw new TypeError('Opening balance currency must be ISO 4217');
    if (!line.evidenceReference.trim()) throw new TypeError(`Evidence is required for ${line.component}`);
    const migrated = new Decimal(line.migratedAmount);
    const ledger = new Decimal(line.generalLedgerAmount);
    const difference = migrated.minus(ledger);
    if (!difference.isZero()) throw new Error(`Opening balance variance for ${line.component}: ${difference.toFixed()}`);
    return { ...line, difference: difference.toFixed(12) };
  });
  const missing = openingBalanceComponents.filter((component) => !seen.has(component));
  if (missing.length) throw new Error(`Opening balance certification is incomplete: ${missing.join(', ')}`);
  const checksumSha256 = createHash('sha256').update(JSON.stringify([...lines].sort((a, b) => a.component.localeCompare(b.component)))).digest('hex');
  return { ...input, signedBy: input.signedBy.trim(), ...(input.correlationId ? { correlationId: input.correlationId.trim().toLowerCase() } : {}), status: 'CERTIFIED' as const, checksumSha256, lines };
}
