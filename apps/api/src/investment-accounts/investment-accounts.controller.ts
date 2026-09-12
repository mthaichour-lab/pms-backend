import { BadRequestException, Body, ConflictException, Controller, Get, Headers, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';

import { GetInvestmentAccountSnapshot } from '../../../../src/modules/investment-accounts/application/get-investment-account-snapshot.js';
import { GET_INVESTMENT_ACCOUNT_SNAPSHOT, MANAGE_INVESTMENT_SUBSCRIPTION } from './investment-accounts.tokens.js';
import { ManageInvestmentSubscription, type SubscriptionAction } from '../../../../src/modules/investment-accounts/application/manage-investment-subscription.js';
import type { InvestmentSubscriptionState } from '../../../../src/modules/investment-accounts/domain/investment-subscription.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';

@Controller('investment-accounts')
export class InvestmentAccountsController {
  constructor(
    @Inject(GET_INVESTMENT_ACCOUNT_SNAPSHOT)
    private readonly getSnapshot: GetInvestmentAccountSnapshot,
    @Inject(MANAGE_INVESTMENT_SUBSCRIPTION) private readonly subscriptions: ManageInvestmentSubscription,
  ) {}

  @Post('subscriptions')
  @RequireAuthorization({operationType:'CREATE_INVESTMENT_SUBSCRIPTION',allowedRoles:['RELATIONSHIP_MANAGER','SYSTEM_ADMIN'],requiredDelegationLevel:2,sensitive:true})
  createSubscription(@Body() body: Omit<InvestmentSubscriptionState,'status'|'openedOn'|'closedOn'|'acceptance'>,@Headers('idempotency-key') key:string|undefined,@AuthenticatedUser() user:AuthenticatedUserClaims){return this.subscriptionRun(()=>this.subscriptions.create(body,user.sub,key??''));}

  @Post('subscriptions/:accountId/actions')
  @RequireAuthorization({operationType:'TRANSITION_INVESTMENT_SUBSCRIPTION',allowedRoles:['RELATIONSHIP_MANAGER','FINANCE_CONTROLLER','SYSTEM_ADMIN'],requiredDelegationLevel:2,sensitive:true})
  action(@Param('accountId')accountId:string,@Body()body:Omit<SubscriptionAction,'actorId'>,@Headers('idempotency-key')key:string|undefined,@AuthenticatedUser()user:AuthenticatedUserClaims){return this.subscriptionRun(()=>this.subscriptions.act(accountId,{...body,actorId:user.sub},key??''));}

  @Get(':accountId')
  async getAccount(
    @Param('accountId') accountId: string,
    @Query('businessDate') businessDate: string | undefined,
  ) {
    if (!businessDate) throw new BadRequestException('businessDate is required');
    try {
      return await this.getSnapshot.execute(accountId, businessDate);
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error && error.message.startsWith('Investment account not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  private async subscriptionRun<T>(operation:()=>Promise<T>){try{return await operation();}catch(error){if(error instanceof TypeError||error instanceof RangeError)throw new BadRequestException(error.message);if(error instanceof Error&&error.message.startsWith('Investment subscription not found'))throw new NotFoundException(error.message);if(error instanceof Error)throw new ConflictException(error.message);throw error;}}
}
