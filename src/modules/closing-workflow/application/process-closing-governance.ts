export interface ClosingGovernanceRepository {
  escalateOverdue(now: string): Promise<{ escalated: number }>;
}

export class ProcessClosingGovernance {
  constructor(private readonly repository: ClosingGovernanceRepository) {}

  execute(now: string): Promise<{ escalated: number }> {
    if (!Number.isFinite(Date.parse(now))) throw new TypeError('now must be an ISO date');
    return this.repository.escalateOverdue(now);
  }
}
