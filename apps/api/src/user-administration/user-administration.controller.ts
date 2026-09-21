import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { ROLE_DESCRIPTIONS, UserAdministrationService } from './user-administration.service.js';

@Controller('admin')
@RequireAuthorization({ operationType: 'ADMINISTER_USERS', allowedRoles: ['SYSTEM_ADMIN'], sensitive: true })
export class UserAdministrationController {
  constructor(private readonly users: UserAdministrationService) {}
  @Get('roles') roles() { return { items: ROLE_DESCRIPTIONS }; }
  @Get('users') list(@Query('search') search?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) { return this.users.list(search, limit === undefined ? 50 : Number(limit), offset === undefined ? 0 : Number(offset)); }
  @Post('users') create(@Body() body: unknown) { return this.users.create(body); }
  @Put('users/:id') update(@Param('id') id: string, @Body() body: unknown, @AuthenticatedUser() actor: AuthenticatedUserClaims) { return this.users.update(id, body, actor.sub); }
}
