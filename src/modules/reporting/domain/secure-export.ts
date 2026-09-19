import { createHash } from 'node:crypto';

export type ExportFormat = 'PDF' | 'XLSX' | 'CSV' | 'API';
export type ExportScope = 'SINGLE' | 'BULK';
export type ExportStatus = 'APPROVED' | 'PENDING_REINFORCED_APPROVAL' | 'GENERATED';
export interface ExportColumn { key: string; label: string; personalData?: boolean }
export interface ExportDataset { columns: readonly ExportColumn[]; rows: readonly Readonly<Record<string, string | number | boolean | null>>[] }

export function initialExportStatus(scope: ExportScope): ExportStatus {
  return scope === 'BULK' ? 'PENDING_REINFORCED_APPROVAL' : 'APPROVED';
}

export function approveMassExport(status: ExportStatus, scope: ExportScope, requesterId: string, approverId: string): ExportStatus {
  if (scope !== 'BULK' || status !== 'PENDING_REINFORCED_APPROVAL') throw new Error('Only a pending bulk export can receive reinforced approval');
  if (!approverId.trim() || approverId === requesterId) throw new Error('Bulk export approval requires a distinct checker');
  return 'APPROVED';
}

export function assertExportDatasetSafe(dataset: ExportDataset): void {
  if (!dataset || !Array.isArray(dataset.columns) || !Array.isArray(dataset.rows) || !dataset.columns.length) {
    throw new TypeError('Export requires at least one column');
  }
  const keys = new Set<string>();
  for (const column of dataset.columns) {
    if (!column || typeof column !== 'object' ||
      typeof column.key !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(column.key) ||
      typeof column.label !== 'string' || !column.label.trim() || column.label.length > 256 ||
      (column.personalData !== undefined && typeof column.personalData !== 'boolean') || keys.has(column.key)) {
      throw new TypeError('Export columns must be unique and valid');
    }
    keys.add(column.key);
  }
  for (const row of dataset.rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('Export rows must be objects');
    for (const column of dataset.columns) {
    const value = row[column.key];
    if (value === undefined) throw new TypeError(`Missing export value for ${column.key}`);
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
      throw new TypeError(`Export values must be scalar: ${column.key}`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError(`Export numbers must be finite: ${column.key}`);
    }
    if (column.personalData && value !== null && (typeof value !== 'string' || !/^tok_[A-Za-z0-9_-]{16,128}$/.test(value))) {
      throw new Error(`Clear personal data is forbidden in exports: ${column.key}`);
    }
    }
  }
}

export function canonicalExport(dataset: ExportDataset): string {
  assertExportDatasetSafe(dataset);
  return JSON.stringify({ columns: dataset.columns.map(({ key, label, personalData = false }) => ({ key, label, personalData })), rows: dataset.rows.map(row => Object.fromEntries(dataset.columns.map(column => [column.key, row[column.key]]))) });
}

export function exportChecksum(dataset: ExportDataset): string { return createHash('sha256').update(canonicalExport(dataset)).digest('hex'); }
