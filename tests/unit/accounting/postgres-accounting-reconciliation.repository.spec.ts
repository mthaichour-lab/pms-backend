import { describe, expect, it, vi } from 'vitest';

import { PostgresAccountingReconciliationRepository } from '../../../src/infrastructure/persistence/postgres-accounting-reconciliation.repository.js';
import type { ReconciliationCommand } from '../../../src/modules/accounting/application/reconcile-general-ledger.js';
import { reconcileAmounts } from '../../../src/modules/accounting/domain/reconciliation.js';

const reconciliationId = 'af662dda-a96b-4e08-9781-f648cd9b11bb';
const discrepancyId = '009cf57f-ea18-4f01-91da-d20f09876cb5';
const command: ReconciliationCommand = {
  businessDate: '2026-09-14', currency: 'DZD', generalLedgerAmount: '100.10',
  sourceReference: 'gl-export-20260914', sourceChecksumSha256: 'a'.repeat(64),
  actorId: 'finance-controller',
};

describe('PostgresAccountingReconciliationRepository', () => {
  it('uses the effective currency scale and emits an outbox event before commit', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reference.currency_version')) {
        return { rows: [{ subledger_amount: '100.100000000000', amount_scale: 2 }] };
      }
      if (sql.includes('INSERT INTO accounting.reconciliation')) {
        return { rows: [{
          reconciliation_id: reconciliationId,
          subledger_amount: '100.100000000000', general_ledger_amount: '100.100000000000',
          difference: '0.000000000000', source_reference: command.sourceReference, state: 'MATCHED',
        }] };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const repository = new PostgresAccountingReconciliationRepository({
      connect: async () => ({ query, release }),
    } as never);

    await expect(repository.reconcileAtomically(command, reconcileAmounts)).resolves.toEqual({
      reconciliationId, state: 'MATCHED', difference: '0.00',
    });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.find((sql) => sql.includes('FROM reference.currency_version')))
      .toContain('c.valid_from <= $1::date');
    expect(statements.findIndex((sql) => sql.includes('INSERT INTO integration.outbox_event')))
      .toBeLessThan(statements.indexOf('COMMIT'));
    expect(release).toHaveBeenCalledOnce();
  });

  it('returns the persisted snapshot on a concurrent replay even when the live ledger changed', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reference.currency_version')) {
        return { rows: [{ subledger_amount: '90.000000000000', amount_scale: 2 }] };
      }
      if (sql.includes('INSERT INTO accounting.reconciliation')) return { rows: [] };
      if (sql.includes('FROM accounting.reconciliation')) {
        return { rows: [{
          reconciliation_id: reconciliationId,
          subledger_amount: '100.100000000000', general_ledger_amount: '100.100000000000',
          difference: '0.000000000000', source_reference: command.sourceReference, state: 'MATCHED',
        }] };
      }
      return { rows: [], rowCount: 1 };
    });
    const repository = new PostgresAccountingReconciliationRepository({
      connect: async () => ({ query, release: vi.fn() }),
    } as never);

    await expect(repository.reconcileAtomically(command, reconcileAmounts)).resolves.toEqual({
      reconciliationId, state: 'MATCHED', difference: '0.00',
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('reconciliation_discrepancy'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('integration.outbox_event'))).toBe(false);
  });

  it('rejects a replay whose discrepancy payload differs and rolls the transaction back', async () => {
    const discrepancy = {
      severity: 'HIGH' as const, ownerId: 'owner-a', cause: 'Timing mismatch',
      correctiveAction: 'Repost source journal', detectedAt: '2026-09-14T10:00:00.000Z',
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reference.currency_version')) {
        return { rows: [{ subledger_amount: '99.000000000000', amount_scale: 2 }] };
      }
      if (sql.includes('INSERT INTO accounting.reconciliation_discrepancy')) return { rows: [] };
      if (sql.includes('FROM accounting.reconciliation_discrepancy')) {
        return { rows: [{
          discrepancy_id: discrepancyId, amount: '-1.100000000000', severity: 'HIGH',
          owner_id: 'another-owner', cause: discrepancy.cause,
          corrective_action: discrepancy.correctiveAction,
          detected_at: new Date(discrepancy.detectedAt),
          resolution_due_at: new Date('2026-09-14T18:00:00.000Z'),
        }] };
      }
      if (sql.includes('INSERT INTO accounting.reconciliation')) return { rows: [] };
      if (sql.includes('FROM accounting.reconciliation')) {
        return { rows: [{
          reconciliation_id: reconciliationId,
          subledger_amount: '99.000000000000', general_ledger_amount: '100.100000000000',
          difference: '-1.100000000000', source_reference: command.sourceReference, state: 'VARIANCE',
        }] };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const repository = new PostgresAccountingReconciliationRepository({
      connect: async () => ({ query, release }),
    } as never);

    await expect(repository.reconcileAtomically({ ...command, discrepancy }, reconcileAmounts))
      .rejects.toThrow('discrepancy replay payload differs');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });
});
