import { Global, Module } from '@nestjs/common';

import { PostgresDatabaseService } from './postgres-database.service.js';

@Global()
@Module({
  providers: [PostgresDatabaseService],
  exports: [PostgresDatabaseService],
})
export class DatabaseModule {}
