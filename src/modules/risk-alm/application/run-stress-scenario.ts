import { executeStressScenario, type StressResult, type StressShock } from '../domain/stress-scenario.js';

export interface RunStressScenarioCommand {
  scenarioCode: string; businessDate: string; currency: string; baseAmount: string;
  shocks: readonly StressShock[]; engineVersion: string; inputChecksumSha256: string; actorId: string;
}
export interface StressScenarioRepository {
  runAtomically(
    command: RunStressScenarioCommand,
    execute: (base: string, currency: string, scale: number, shocks: readonly StressShock[]) => StressResult[],
  ): Promise<{ stressScenarioId: string; state: 'COMPLETED'; results: readonly StressResult[] }>;
}

export class RunStressScenario {
  constructor(private readonly repository: StressScenarioRepository) {}
  execute(command: RunStressScenarioCommand) {
    if (!/^[A-Z][A-Z0-9_-]{1,63}$/.test(command.scenarioCode)) throw new TypeError('Invalid stress scenario code');
    if (!isCalendarDate(command.businessDate)) throw new TypeError('Stress business date must be a valid YYYY-MM-DD date');
    if (!/^[A-Z]{3}$/.test(command.currency)) throw new TypeError('Stress currency must be ISO uppercase');
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(command.baseAmount)) throw new TypeError('Stress base amount must be a non-negative canonical decimal with at most 12 decimals');
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(command.engineVersion)) throw new TypeError('Invalid stress engine version');
    if (!/^[0-9a-f]{64}$/.test(command.inputChecksumSha256)) throw new TypeError('Stress input checksum must be lowercase SHA-256');
    const actorId = command.actorId.trim();
    if (!actorId) throw new TypeError('Stress actor is required');
    return this.repository.runAtomically({ ...command, actorId }, executeStressScenario);
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
