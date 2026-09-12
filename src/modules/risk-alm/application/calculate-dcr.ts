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
    if (!command.poolId.trim()) throw new TypeError('DCR pool is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(command.businessDate)) throw new TypeError('DCR business date must use YYYY-MM-DD');
    if (!/^[A-Z]{3}$/.test(command.currency)) throw new TypeError('DCR currency must be ISO uppercase');
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(command.capitalDurationAmount) ||
      !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(command.riskWeightedDurationAmount)) {
      throw new TypeError('DCR amounts must be canonical decimals');
    }
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(command.formulaVersion)) throw new TypeError('Invalid DCR formula version');
    if (!/^[0-9a-f]{64}$/.test(command.inputChecksumSha256)) throw new TypeError('DCR input checksum must be lowercase SHA-256');
    if (!command.actorId.trim()) throw new TypeError('DCR calculation actor is required');
    return this.repository.calculateAtomically({ ...command, poolId: command.poolId.trim() }, calculateDcr);
  }
}
