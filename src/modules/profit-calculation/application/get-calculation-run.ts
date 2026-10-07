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
  list(input: CalculationRunListQuery): Promise<CalculationRunListPage>;
}

export interface CalculationRunListQuery {
  limit: number;
  offset: number;
  poolId?: string;
  status?: CalculationRunView['status'];
}

export interface CalculationRunListPage {
  items: readonly CalculationRunView[];
  total: number;
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

export class ListCalculationRuns {
  constructor(private readonly repository: CalculationRunQueryRepository) {}

  execute(input: CalculationRunListQuery): Promise<CalculationRunListPage> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      throw new RangeError('Calculation list limit must be between 1 and 100');
    }
    if (!Number.isInteger(input.offset) || input.offset < 0) {
      throw new RangeError('Calculation list offset must be a non-negative integer');
    }
    if (input.poolId !== undefined && !/^[A-Z0-9_-]{2,32}$/.test(input.poolId)) {
      throw new TypeError('Invalid calculation pool');
    }
    const statuses: readonly CalculationRunView['status'][] = ['DRAFT','CALCULATED','CONTROLLED','APPROVED','POSTED','ARCHIVED','FAILED'];
    if (input.status !== undefined && !statuses.includes(input.status)) {
      throw new TypeError('Invalid calculation status');
    }
    return this.repository.list(input);
  }
}
