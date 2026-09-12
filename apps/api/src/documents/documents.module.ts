import { Module } from '@nestjs/common';
import { PostgresDocumentArchiveRequestRepository } from '../../../../src/infrastructure/persistence/postgres-document-archive-request.repository.js';
import { RequestDocumentArchive } from '../../../../src/modules/documents/application/request-document-archive.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { DocumentsController } from './documents.controller.js';
import { REQUEST_DOCUMENT_ARCHIVE } from './documents.tokens.js';

@Module({
  controllers: [DocumentsController],
  providers: [{ provide: REQUEST_DOCUMENT_ARCHIVE, inject: [PostgresDatabaseService], useFactory: (database: PostgresDatabaseService) => new RequestDocumentArchive(new PostgresDocumentArchiveRequestRepository(database.pool)) }],
})
export class DocumentsModule {}
