export interface InvestmentPositionValidationResult {
  rowCount: number;
  invalidBusinessDateCount: number;
}

export interface InvestmentPositionValidationRepository {
  inspect(batchId: string, expectedBusinessDate: string): Promise<InvestmentPositionValidationResult>;
  recordDecision(batchId: string, decision: 'VALIDATED' | 'REJECTED', reason?: string): Promise<void>;
}

export class ValidateInvestmentPositions {
  constructor(private readonly repository: InvestmentPositionValidationRepository) {}

  async execute(batchId: string, expectedBusinessDate: string): Promise<'VALIDATED' | 'REJECTED'> {
    const result = await this.repository.inspect(batchId, expectedBusinessDate);
    const failures: string[] = [];
    if (result.rowCount === 0) failures.push('EMPTY_BATCH');
    if (result.invalidBusinessDateCount > 0) failures.push('BUSINESS_DATE_MISMATCH');
    if (failures.length > 0) {
      await this.repository.recordDecision(batchId, 'REJECTED', failures.join(','));
      return 'REJECTED';
    }
    await this.repository.recordDecision(batchId, 'VALIDATED');
    return 'VALIDATED';
  }
}
