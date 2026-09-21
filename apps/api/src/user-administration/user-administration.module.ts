import { Module } from '@nestjs/common';
import { UserAdministrationController } from './user-administration.controller.js';
import { UserAdministrationService } from './user-administration.service.js';

@Module({ controllers: [UserAdministrationController], providers: [UserAdministrationService] })
export class UserAdministrationModule {}
