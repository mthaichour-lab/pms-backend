import { Module } from '@nestjs/common';
import { KmsHttpAuditSigner } from '../../../../src/infrastructure/kms/kms-http-audit-signer.adapter.js';
import { PostgresAuditRepository } from '../../../../src/infrastructure/persistence/postgres-audit.repository.js';
import { PostgresAuditTrailRepository } from '../../../../src/infrastructure/persistence/postgres-audit-trail.repository.js';
import { QueryAuditTrail } from '../../../../src/modules/audit/application/query-audit-trail.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { AuditController } from './audit.controller.js';
import { AUDIT_EVENT_WRITER, QUERY_AUDIT_TRAIL } from './audit.tokens.js';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

@Module({
  controllers: [AuditController],
  providers: [
    {
      provide: QUERY_AUDIT_TRAIL,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) => new QueryAuditTrail(new PostgresAuditTrailRepository(database.pool)),
    },
    {
      provide: AUDIT_EVENT_WRITER,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) => new PostgresAuditRepository(
        database.pool,
        new KmsHttpAuditSigner({
          baseUrl: requiredEnvironment('KMS_URL'),
          keyId: requiredEnvironment('KMS_AUDIT_KEY_ID'),
          workloadToken: () => requiredEnvironment('KMS_WORKLOAD_TOKEN'),
        }),
      ),
    },
  ],
  exports: [AUDIT_EVENT_WRITER],
})
export class AuditModule {}
