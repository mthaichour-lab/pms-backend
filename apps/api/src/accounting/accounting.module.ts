import { Module } from '@nestjs/common';

import { PostgresAccountingPostingRepository } from '../../../../src/infrastructure/persistence/postgres-accounting-posting.repository.js';
import { PostgresAccountingReversalRepository } from '../../../../src/infrastructure/persistence/postgres-accounting-reversal.repository.js';
import { PostgresAccountingReconciliationRepository } from '../../../../src/infrastructure/persistence/postgres-accounting-reconciliation.repository.js';
import { PostgresAccountingEventRepository } from '../../../../src/infrastructure/persistence/postgres-accounting-event.repository.js';
import { PostApprovedCalculation } from '../../../../src/modules/accounting/application/post-approved-calculation.js';
import { ReversePostedJournal } from '../../../../src/modules/accounting/application/reverse-posted-journal.js';
import { ReconcileGeneralLedger } from '../../../../src/modules/accounting/application/reconcile-general-ledger.js';
import { ManageAccountingEvent } from '../../../../src/modules/accounting/application/manage-accounting-event.js';
import { CertifyOpeningBalances } from '../../../../src/modules/accounting/application/certify-opening-balances.js';
import { PostgresOpeningBalanceCertificationRepository } from '../../../../src/infrastructure/persistence/postgres-opening-balance-certification.repository.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { AccountingController } from './accounting.controller.js';
import { CERTIFY_OPENING_BALANCES, MANAGE_ACCOUNTING_EVENT, POST_APPROVED_CALCULATION, RECONCILE_GENERAL_LEDGER, REVERSE_POSTED_JOURNAL } from './accounting.tokens.js';

@Module({
  controllers: [AccountingController],
  providers: [
    {
      provide: CERTIFY_OPENING_BALANCES,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) =>
        new CertifyOpeningBalances(new PostgresOpeningBalanceCertificationRepository(database.pool)),
    },
    {
      provide: MANAGE_ACCOUNTING_EVENT,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) =>
        new ManageAccountingEvent(new PostgresAccountingEventRepository(database.pool)),
    },
    {
      provide: POST_APPROVED_CALCULATION,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) =>
        new PostApprovedCalculation(new PostgresAccountingPostingRepository(database.pool)),
    },
    {
      provide: REVERSE_POSTED_JOURNAL,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) =>
        new ReversePostedJournal(new PostgresAccountingReversalRepository(database.pool)),
    },
    {
      provide: RECONCILE_GENERAL_LEDGER,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) =>
        new ReconcileGeneralLedger(new PostgresAccountingReconciliationRepository(database.pool)),
    },
  ],
})
export class AccountingModule {}
