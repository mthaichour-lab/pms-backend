import { Money } from '../../../shared-kernel/money.js';
import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';

export interface StressShock { bucket: string; basisPoints: number }
export interface StressResult { bucket: string; basisPoints: number; stressedAmount: string; impactAmount: string }
export interface FullEngineStressSnapshot { sourceRunId:string;values:Readonly<Record<string,string>>; }
export interface FullEngineStressResult<T> { sourceRunId:string;shockedValues:Readonly<Record<string,string>>;engineResult:T;outputChecksumSha256:string; }

export function executeStressScenario(
  baseAmount: string, currency: string, scale: number, shocks: readonly StressShock[],
): StressResult[] {
  const base = Money.parse(baseAmount, currency, scale);
  if (base.toMinorUnits() < 0n) throw new RangeError('Stress base amount cannot be negative');
  if (shocks.length === 0 || shocks.length > 100) throw new RangeError('Stress scenario requires between 1 and 100 shocks');
  const buckets = new Set<string>();
  return shocks.map((shock) => {
    if (!/^[A-Z][A-Z0-9_-]{1,63}$/.test(shock.bucket) || buckets.has(shock.bucket)) {
      throw new TypeError('Stress buckets must be unique uppercase codes');
    }
    buckets.add(shock.bucket);
    if (!Number.isInteger(shock.basisPoints) || shock.basisPoints < -10_000 || shock.basisPoints > 10_000) {
      throw new RangeError('Stress shock must be an integer between -10000 and 10000 basis points');
    }
    const numerator = base.toMinorUnits() * BigInt(shock.basisPoints);
    const absolute = numerator < 0n ? -numerator : numerator;
    let impactMinor = absolute / 10_000n;
    if ((absolute % 10_000n) * 2n >= 10_000n) impactMinor += 1n;
    if (numerator < 0n) impactMinor = -impactMinor;
    const impact = Money.fromMinorUnits(impactMinor, currency, scale);
    const stressed = base.add(impact);
    if (stressed.toMinorUnits() < 0n) throw new RangeError('Stress shock produces a negative amount');
    return {
      bucket: shock.bucket, basisPoints: shock.basisPoints,
      stressedAmount: stressed.toDecimalString(), impactAmount: impact.toDecimalString(),
    };
  });
}

export function executeFullEngineStressScenario<T>(
  snapshot: FullEngineStressSnapshot,
  shocks: readonly StressShock[],
  rerunEngine: (shockedValues: Readonly<Record<string, string>>) => T,
): FullEngineStressResult<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(snapshot.sourceRunId)) {
    throw new TypeError('Stress sourceRunId must be a UUID');
  }
  if (shocks.length === 0 || shocks.length > 100) throw new RangeError('Stress scenario requires between 1 and 100 shocks');
  const shockedValues: Record<string, string> = { ...snapshot.values };
  const seen = new Set<string>();
  for (const shock of shocks) {
    if (!/^[A-Z][A-Z0-9_-]{1,63}$/.test(shock.bucket) || seen.has(shock.bucket)) throw new TypeError('Stress buckets must be unique uppercase codes');
    seen.add(shock.bucket);
    if (!Number.isInteger(shock.basisPoints) || shock.basisPoints < -10_000 || shock.basisPoints > 10_000) throw new RangeError('Stress shock must be an integer between -10000 and 10000 basis points');
    const source = snapshot.values[shock.bucket];
    if (source === undefined || !/^(0|[1-9]\d*)(?:\.\d+)?$/.test(source)) throw new TypeError(`Stress bucket ${shock.bucket} is absent or non-numeric in the source snapshot`);
    const stressed = new Decimal(source).times(new Decimal(1).plus(new Decimal(shock.basisPoints).dividedBy(10_000)));
    if (stressed.isNegative()) throw new RangeError(`Stress bucket ${shock.bucket} produces a negative value`);
    shockedValues[shock.bucket] = stressed.toDecimalPlaces(12, Decimal.ROUND_HALF_EVEN).toFixed(12);
  }
  const engineResult = rerunEngine(Object.freeze({ ...shockedValues }));
  const canonical = JSON.stringify({ sourceRunId:snapshot.sourceRunId,shockedValues:Object.fromEntries(Object.entries(shockedValues).sort(([a],[b])=>a.localeCompare(b))),engineResult });
  return { sourceRunId:snapshot.sourceRunId,shockedValues,engineResult,outputChecksumSha256:createHash('sha256').update(canonical).digest('hex') };
}
