export interface InvestmentPositionValidationResult {
  rowCount: number;
  invalidBusinessDateCount: number;
  manifestRowCount: number;
  manifestBalanceTotal: string;
  stagedBalanceTotal: string;
  unknownCurrencyCount: number;
  unknownProductCount: number;
  invalidChronologyCount: number;
}

export interface InvestmentPositionValidationRepository {
  inspect(batchId: string, expectedBusinessDate: string): Promise<InvestmentPositionValidationResult>;
  recordDecision(batchId: string, decision: 'VALIDATED' | 'REJECTED', reason?: string): Promise<void>;
  quarantineInvalidRows(batchId: string, expectedBusinessDate: string): Promise<number>;
}

export class ValidateInvestmentPositions {
  constructor(private readonly repository: InvestmentPositionValidationRepository) {}

  async execute(batchId: string, expectedBusinessDate: string): Promise<'VALIDATED' | 'REJECTED'> {
    const result = await this.repository.inspect(batchId, expectedBusinessDate);
    const failures: string[] = [];
    if (result.rowCount === 0) failures.push('EMPTY_BATCH');
    if (result.invalidBusinessDateCount > 0) failures.push('BUSINESS_DATE_MISMATCH');
    if (result.rowCount !== result.manifestRowCount) failures.push('MANIFEST_ROW_COUNT_MISMATCH');
    if (!decimalEqual(result.stagedBalanceTotal, result.manifestBalanceTotal)) failures.push('MANIFEST_BALANCE_MISMATCH');
    if (result.unknownCurrencyCount > 0) failures.push('UNKNOWN_CURRENCY');
    if (result.unknownProductCount > 0) failures.push('UNKNOWN_PRODUCT');
    if (result.invalidChronologyCount > 0) failures.push('INVALID_DATE_CHRONOLOGY');
    if (failures.length > 0) {
      await this.repository.quarantineInvalidRows(batchId, expectedBusinessDate);
      await this.repository.recordDecision(batchId, 'REJECTED', failures.join(','));
      return 'REJECTED';
    }
    await this.repository.recordDecision(batchId, 'VALIDATED');
    return 'VALIDATED';
  }
}

function decimalEqual(left: string, right: string): boolean {
  const scale = (value: string) => {
    const negative = value.startsWith('-'); const unsigned = negative ? value.slice(1) : value;
    const [whole, fraction = ''] = unsigned.split('.');
    const result = BigInt(whole) * 1_000_000_000_000n + BigInt(fraction.padEnd(12, '0'));
    return negative ? -result : result;
  };
  return scale(left) === scale(right);
}
