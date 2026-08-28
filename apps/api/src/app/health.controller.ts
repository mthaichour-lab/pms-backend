import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/public.decorator.js';

@Controller('health')
@Public()
export class HealthController {
  @Get('startup')
  startup() {
    return { status: 'started' };
  }

  @Get('ready')
  ready() {
    return { status: 'ready' };
  }

  @Get('live')
  live() {
    return { status: 'alive' };
  }
}
