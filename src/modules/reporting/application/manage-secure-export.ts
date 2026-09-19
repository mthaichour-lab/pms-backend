import type { ExportDataset, ExportFormat, ExportScope, ExportStatus } from '../domain/secure-export.js';
import { approveMassExport, assertExportDatasetSafe, exportChecksum, initialExportStatus } from '../domain/secure-export.js';

export interface CreateSecureExportCommand { reportType: string; format: ExportFormat; scope: ExportScope; filters?: Readonly<Record<string, string>>; requesterId: string; idempotencyKey: string; correlationId: string }
export interface SecureExportRepository {
  create(command: CreateSecureExportCommand, status: ExportStatus): Promise<{ exportId: string; status: ExportStatus }>;
  approve(exportId: string, approverId: string, idempotencyKey: string, correlationId: string, decide: typeof approveMassExport): Promise<{ status: ExportStatus }>;
  generate(exportId: string, actorId: string, dataset: ExportDataset, checksum: string, idempotencyKey: string, correlationId: string): Promise<{ exportId: string; status: 'GENERATED'; checksumSha256: string }>;
}
export class ManageSecureExport {
  constructor(private readonly repository: SecureExportRepository) {}
  create(command: CreateSecureExportCommand) {
    const requesterId = command.requesterId.trim();
    const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);
    const correlationId = normalizeUuid(command.correlationId, 'Export correlation identifier');
    if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(command.reportType) || !requesterId) throw new TypeError('Export report, requester and idempotency key are required');
    if (!['PDF','XLSX','CSV','API'].includes(command.format) || !['SINGLE','BULK'].includes(command.scope)) throw new TypeError('Unsupported export format or scope');
    return this.repository.create({
      ...command, requesterId, idempotencyKey, correlationId, filters: normalizeFilters(command.filters),
    }, initialExportStatus(command.scope));
  }
  approve(exportId: string, approverId: string, idempotencyKey: string, correlationId: string) {
    const action = validateAction(exportId, approverId, idempotencyKey, correlationId);
    return this.repository.approve(
      action.exportId, action.actorId, action.idempotencyKey, action.correlationId, approveMassExport,
    );
  }
  generate(exportId: string, actorId: string, dataset: ExportDataset, idempotencyKey: string, correlationId: string) {
    const action = validateAction(exportId, actorId, idempotencyKey, correlationId);
    assertExportDatasetSafe(dataset);
    return this.repository.generate(
      action.exportId, action.actorId, dataset, exportChecksum(dataset), action.idempotencyKey,
      action.correlationId,
    );
  }
}

function validateAction(exportId: string, actorId: string, key: string, correlationId: string) {
  const normalizedActorId = actorId.trim();
  if (!UUID_PATTERN.test(exportId) || !normalizedActorId) {
    throw new TypeError('Export identifier, actor and idempotency key are required');
  }
  return {
    exportId: exportId.toLowerCase(), actorId: normalizedActorId,
    idempotencyKey: normalizeIdempotencyKey(key),
    correlationId: normalizeUuid(correlationId, 'Export correlation identifier'),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value: string, label: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new TypeError(`${label} must be a UUID`);
  return normalized;
}

function normalizeIdempotencyKey(value: string): string {
  const key = value.trim();
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(key)) {
    throw new TypeError('Export idempotency key must contain between 16 and 128 characters');
  }
  return key;
}

function normalizeFilters(filters: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> {
  if (filters === undefined) return {};
  if (filters === null || Array.isArray(filters) || typeof filters !== 'object') {
    throw new TypeError('Export filters must be a string map');
  }
  const entries = Object.entries(filters).sort(([left], [right]) => left.localeCompare(right));
  for (const [key, value] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key) || typeof value !== 'string' || value.length > 1024) {
      throw new TypeError('Export filters must be a string map');
    }
  }
  return Object.fromEntries(entries);
}
