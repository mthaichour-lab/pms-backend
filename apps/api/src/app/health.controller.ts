import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';

import { Public } from '../auth/public.decorator.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(@Inject(PostgresDatabaseService) private readonly database: Pick<PostgresDatabaseService, 'readiness'>) {}

  @Get('startup')
  startup() {
    return { status: 'started' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.readiness();
      return { status: 'ready', checks: { postgres: 'up' } };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', checks: { postgres: 'down' } });
    }
  }

  @Get('live')
  live() {
    return { status: 'alive' };
  }
}
