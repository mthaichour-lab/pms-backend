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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(command.businessDate)) throw new TypeError('Stress business date must use YYYY-MM-DD');
    if (!/^[A-Z]{3}$/.test(command.currency)) throw new TypeError('Stress currency must be ISO uppercase');
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(command.baseAmount)) throw new TypeError('Stress base amount must be a non-negative canonical decimal');
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(command.engineVersion)) throw new TypeError('Invalid stress engine version');
    if (!/^[0-9a-f]{64}$/.test(command.inputChecksumSha256)) throw new TypeError('Stress input checksum must be lowercase SHA-256');
    if (!command.actorId.trim()) throw new TypeError('Stress actor is required');
    return this.repository.runAtomically(command, executeStressScenario);
  }
}
