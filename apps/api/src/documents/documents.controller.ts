import { BadRequestException, Body, ConflictException, Controller, Get, Headers, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { RequestDocumentArchive, type RequestDocumentArchiveCommand } from '../../../../src/modules/documents/application/request-document-archive.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { REQUEST_DOCUMENT_ARCHIVE } from './documents.tokens.js';

@Controller('documents/archive-requests')
export class DocumentsController {
  constructor(@Inject(REQUEST_DOCUMENT_ARCHIVE) private readonly archives: RequestDocumentArchive) {}

  @Post()
  @RequireAuthorization({ operationType: 'REQUEST_DOCUMENT_ARCHIVE', allowedRoles: ['FINANCE_ANALYST','FINANCE_CONTROLLER','RISK_ANALYST','SHARIA_AUDITOR','SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  enqueue(@Body() body: Omit<RequestDocumentArchiveCommand, 'actorId'|'idempotencyKey'|'correlationId'>, @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.handle(() => this.archives.enqueue({ ...body, actorId: user.sub, idempotencyKey: key ?? '', ...(correlationId ? { correlationId } : {}) }));
  }

  @Get(':requestId')
  @RequireAuthorization({ operationType: 'READ_DOCUMENT_ARCHIVE', allowedRoles: ['FINANCE_ANALYST','FINANCE_CONTROLLER','RISK_ANALYST','SHARIA_AUDITOR','SYSTEM_ADMIN'], requiredDelegationLevel: 1, sensitive: true })
  get(@Param('requestId') requestId: string) { return this.handle(() => this.archives.get(requestId)); }

  private async handle<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message);
      if (error instanceof Error && error.message.endsWith('not found')) throw new NotFoundException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}
