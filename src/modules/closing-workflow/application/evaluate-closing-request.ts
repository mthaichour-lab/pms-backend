import { evaluateClosingControls, type ClosingControlCounts } from '../domain/closing-controls.js';

export interface ClosingRequest {
  closingId: string;
  businessDate: string;
  requestedBy: string;
  correlationId: string;
}

export interface ClosingControlRepository {
  evaluateAndRecord(
    request: ClosingRequest,
    decide: (counts: ClosingControlCounts) => { passed: boolean; blockers: readonly string[] },
  ): Promise<{ state: 'CONTROLS_PASSED' | 'BLOCKED'; blockers: readonly string[] }>;
}

export class EvaluateClosingRequest {
  constructor(private readonly repository: ClosingControlRepository) {}

  execute(request: ClosingRequest) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.closingId)) {
      throw new TypeError('Closing identifier must be a UUID');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request.businessDate)) throw new TypeError('Invalid closing business date');
    if (!request.requestedBy.trim()) throw new TypeError('Closing requester is required');
    return this.repository.evaluateAndRecord(request, evaluateClosingControls);
  }
}
