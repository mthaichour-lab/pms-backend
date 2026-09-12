import { verifyAuditHash, type SignedAuditEvent } from '../domain/audit-chain.js';

export interface AuditTrailRepository {
  latestWindow(scanLimit: number, filters: AuditTrailFilters): Promise<AuditTrailWindow>;
}

export interface AuditTrailWindow {
  events: readonly SignedAuditEvent[];
  matches: readonly boolean[];
  predecessorExists: readonly boolean[];
}

export interface AuditTrailFilters {
  action?: string;
  resourceType?: string;
  outcome?: SignedAuditEvent['outcome'];
  correlationId?: string;
  businessDateFrom?: string;
  businessDateTo?: string;
}

export interface AuditTrailResult {
  events: readonly SignedAuditEvent[];
  integrity: 'HASH_CHAIN';
  chainValid: boolean;
  verifiedCount: number;
  brokenAtEventId?: string;
}

export class QueryAuditTrail {
  constructor(private readonly repository: AuditTrailRepository) {}

  async execute(limit = 50, filters: AuditTrailFilters = {}): Promise<AuditTrailResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new RangeError('Audit trail limit must be between 1 and 200');
    validateFilters(filters);
    const filtered = Object.values(filters).some((value) => value !== undefined);
    const scanLimit = filtered ? Math.min(limit * 10, 2_000) : limit;
    const window = await this.repository.latestWindow(scanLimit, filters);
    if (window.events.length !== window.matches.length || window.events.length !== window.predecessorExists.length) throw new Error('Invalid audit trail verification window');
    const projected = window.events.filter((_, index) => window.matches[index]).slice(-limit);
    let previous: SignedAuditEvent | undefined;
    for (const [index, event] of window.events.entries()) {
      if (!verifyAuditHash(event) || !window.predecessorExists[index] || (previous && event.previousHash !== previous.eventHash)) {
        return { events: projected, integrity: 'HASH_CHAIN', chainValid: false, verifiedCount: index, brokenAtEventId: event.auditEventId };
      }
      previous = event;
    }
    return { events: projected, integrity: 'HASH_CHAIN', chainValid: true, verifiedCount: window.events.length };
  }
}

function validateFilters(filters: AuditTrailFilters): void {
  if (filters.action !== undefined && !/^[A-Z][A-Z0-9_.:-]{0,127}$/.test(filters.action)) throw new TypeError('Invalid audit action filter');
  if (filters.resourceType !== undefined && !/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/.test(filters.resourceType)) throw new TypeError('Invalid audit resource type filter');
  if (filters.outcome !== undefined && !['SUCCESS', 'DENIED', 'FAILURE'].includes(filters.outcome)) throw new TypeError('Invalid audit outcome filter');
  if (filters.correlationId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filters.correlationId)) throw new TypeError('Invalid audit correlation identifier filter');
  for (const [name, value] of [['businessDateFrom', filters.businessDateFrom], ['businessDateTo', filters.businessDateTo]] as const) {
    if (value !== undefined && !isDate(value)) throw new TypeError(`Invalid audit ${name} filter`);
  }
  if (filters.businessDateFrom && filters.businessDateTo && filters.businessDateFrom > filters.businessDateTo) throw new RangeError('Audit business date range is inverted');
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
