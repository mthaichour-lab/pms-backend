export interface CalculationRunView {
  runId: string;
  poolId: string;
  businessDate: string;
  rulesVersion: string;
  engineVersion: string;
  status: 'DRAFT' | 'CALCULATED' | 'CONTROLLED' | 'APPROVED' | 'POSTED' | 'ARCHIVED' | 'FAILED';
  inputChecksumSha256?: string;
  outputChecksumSha256?: string;
  distributableAmount?: string;
  currency?: string;
  allocations: readonly { participantId: string; amount: string; currency: string }[];
}

export interface CalculationRunQueryRepository {
  findById(runId: string): Promise<CalculationRunView | undefined>;
}

export class GetCalculationRun {
  constructor(private readonly repository: CalculationRunQueryRepository) {}

  async execute(runId: string): Promise<CalculationRunView> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
      throw new TypeError('Calculation run identifier must be a UUID');
    }
    const run = await this.repository.findById(runId);
    if (!run) throw new Error(`Calculation run not found: ${runId}`);
    return run;
  }
}
