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
    if (!isCalendarDate(request.businessDate)) throw new TypeError('Invalid closing business date');
    if (!request.requestedBy.trim()) throw new TypeError('Closing requester is required');
    const correlationId = request.correlationId.trim().toLowerCase();
    if (!isUuid(correlationId)) throw new TypeError('Closing correlation identifier must be a UUID');
    return this.repository.evaluateAndRecord({ ...request, requestedBy: request.requestedBy.trim(), correlationId }, evaluateClosingControls);
  }
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
