import { calculateDcr, type DcrInput, type DcrResult } from '../domain/dcr.js';

export interface CalculateDcrCommand {
  poolId: string;
  businessDate: string;
  currency: string;
  capitalDurationAmount: string;
  riskWeightedDurationAmount: string;
  threshold: string;
  formulaVersion: string;
  inputChecksumSha256: string;
  actorId: string;
}

export interface DcrRepository {
  calculateAtomically(
    command: CalculateDcrCommand,
    calculate: (input: DcrInput) => DcrResult,
  ): Promise<DcrResult & { dcrCalculationId: string }>;
}

export class CalculateDcr {
  constructor(private readonly repository: DcrRepository) {}

  execute(command: CalculateDcrCommand) {
    const poolId = command.poolId.trim();
    const actorId = command.actorId.trim();
    if (!poolId) throw new TypeError('DCR pool is required');
    if (!isCalendarDate(command.businessDate)) throw new TypeError('DCR business date must be a valid YYYY-MM-DD date');
    if (!/^[A-Z]{3}$/.test(command.currency)) throw new TypeError('DCR currency must be ISO uppercase');
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(command.capitalDurationAmount) ||
      !/^-?(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(command.riskWeightedDurationAmount)) {
      throw new TypeError('DCR amounts must be canonical decimals with at most 12 decimals');
    }
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(command.formulaVersion)) throw new TypeError('Invalid DCR formula version');
    if (!/^[0-9a-f]{64}$/.test(command.inputChecksumSha256)) throw new TypeError('DCR input checksum must be lowercase SHA-256');
    if (!actorId) throw new TypeError('DCR calculation actor is required');
    return this.repository.calculateAtomically({ ...command, poolId, actorId }, calculateDcr);
  }
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}
