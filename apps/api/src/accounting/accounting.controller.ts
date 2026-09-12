import {
  BadRequestException, Body, ConflictException, Controller, Headers, Inject, Param, Post,
} from '@nestjs/common';

import { PostApprovedCalculation } from '../../../../src/modules/accounting/application/post-approved-calculation.js';
import { ReversePostedJournal } from '../../../../src/modules/accounting/application/reverse-posted-journal.js';
import { ReconcileGeneralLedger } from '../../../../src/modules/accounting/application/reconcile-general-ledger.js';
import { ManageAccountingEvent, type AcknowledgeAccountingEventCommand, type EmitAccountingEventCommand } from '../../../../src/modules/accounting/application/manage-accounting-event.js';
import { CertifyOpeningBalances } from '../../../../src/modules/accounting/application/certify-opening-balances.js';
import type { OpeningBalanceEvidence } from '../../../../src/modules/accounting/domain/opening-balance-certification.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { CERTIFY_OPENING_BALANCES, MANAGE_ACCOUNTING_EVENT, POST_APPROVED_CALCULATION, RECONCILE_GENERAL_LEDGER, REVERSE_POSTED_JOURNAL } from './accounting.tokens.js';

@Controller('accounting')
export class AccountingController {
  constructor(
    @Inject(POST_APPROVED_CALCULATION)
    private readonly postCalculation: PostApprovedCalculation,
    @Inject(REVERSE_POSTED_JOURNAL)
    private readonly reverseJournal: ReversePostedJournal,
    @Inject(RECONCILE_GENERAL_LEDGER)
    private readonly reconcileLedger: ReconcileGeneralLedger,
    @Inject(MANAGE_ACCOUNTING_EVENT)
    private readonly accountingEvents?: ManageAccountingEvent,
    @Inject(CERTIFY_OPENING_BALANCES)
    private readonly certifyOpening?: CertifyOpeningBalances,
  ) {}

  @Post('opening-balances/certifications')
  @RequireAuthorization({ operationType: 'CERTIFY_OPENING_BALANCES', allowedRoles: ['FINANCE_CONTROLLER','SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  async certifyOpeningBalances(
    @Body() body: { certificationId: string; signedAt: string; lines: OpeningBalanceEvidence[] },
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    try {
      if (!this.certifyOpening) throw new Error('Opening balance certification service is unavailable');
      return await this.certifyOpening.execute({ ...body, signedBy: user.sub });
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post('events')
  @RequireAuthorization({ operationType: 'EMIT_ACCOUNTING_EVENT', allowedRoles: ['FINANCE_CONTROLLER','SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  async emitEvent(
    @Body() body: Omit<EmitAccountingEventCommand,'actorId'|'idempotencyKey'>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    try { if(!this.accountingEvents)throw new Error('Accounting event service is unavailable');return await this.accountingEvents.emit({...body,actorId:user.sub,idempotencyKey:idempotencyKey??''}); }
    catch(error){if(error instanceof TypeError)throw new BadRequestException(error.message);if(error instanceof Error)throw new ConflictException(error.message);throw error;}
  }

  @Post('journals/:journalEntryId/acknowledgements')
  @RequireAuthorization({ operationType: 'ACKNOWLEDGE_ACCOUNTING_EVENT', allowedRoles: ['FINANCE_CONTROLLER','SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  async acknowledgeEvent(
    @Param('journalEntryId') journalEntryId:string,
    @Body() body: Pick<AcknowledgeAccountingEventCommand,'action'|'externalReference'|'reason'>,
    @Headers('idempotency-key') idempotencyKey:string|undefined,
    @AuthenticatedUser() user:AuthenticatedUserClaims,
  ) {
    try{if(!this.accountingEvents)throw new Error('Accounting event service is unavailable');return await this.accountingEvents.acknowledge({...body,journalEntryId,actorId:user.sub,idempotencyKey:idempotencyKey??''});}
    catch(error){if(error instanceof TypeError)throw new BadRequestException(error.message);if(error instanceof Error)throw new ConflictException(error.message);throw error;}
  }

  @Post('runs/:runId/post')
  @RequireAuthorization({
    operationType: 'POST_CALCULATION', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 3, sensitive: true,
  })
  async postRun(
    @Param('runId') runId: string,
    @Body() body: { justification?: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    try {
      return await this.postCalculation.execute({
        runId, actorId: user.sub, justification: body.justification ?? '',
        idempotencyKey: idempotencyKey ?? '',
      });
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post('reconciliations')
  @RequireAuthorization({
    operationType: 'RECONCILE_LEDGER', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 2, sensitive: true,
  })
  async reconcile(
    @Body() body: {
      businessDate?: string; currency?: string; generalLedgerAmount?: string;
      sourceReference?: string; sourceChecksumSha256?: string;
      discrepancy?: { severity: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'; ownerId: string; cause: string; correctiveAction: string; detectedAt: string };
    },
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    try {
      return await this.reconcileLedger.execute({
        businessDate: body.businessDate ?? '', currency: body.currency ?? '',
        generalLedgerAmount: body.generalLedgerAmount ?? '', sourceReference: body.sourceReference ?? '',
        sourceChecksumSha256: body.sourceChecksumSha256 ?? '', actorId: user.sub,
        ...(body.discrepancy ? { discrepancy: body.discrepancy } : {}),
      });
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post('journals/:journalEntryId/reverse')
  @RequireAuthorization({
    operationType: 'REVERSE_JOURNAL', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 3, sensitive: true,
  })
  async reverseEntry(
    @Param('journalEntryId') journalEntryId: string,
    @Body() body: { justification?: string; reversalBusinessDate?: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    try {
      return await this.reverseJournal.execute({
        journalEntryId, reversalBusinessDate: body.reversalBusinessDate ?? '', actorId: user.sub,
        justification: body.justification ?? '', idempotencyKey: idempotencyKey ?? '',
      });
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}
