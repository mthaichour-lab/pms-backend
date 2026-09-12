import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import { GetEffectiveRegulatoryRule } from '../../../../src/modules/reference-data/application/regulatory-reference.js';
import { GET_EFFECTIVE_REGULATORY_RULE } from './reference-data.tokens.js';

@Controller('reference-data/regulatory-rules')
export class RegulatoryReferenceController {
  constructor(@Inject(GET_EFFECTIVE_REGULATORY_RULE) private readonly getRule: GetEffectiveRegulatoryRule) {}

  @Get(':ruleCode')
  async getEffectiveRule(@Param('ruleCode') ruleCode: string, @Query('businessDate') businessDate?: string) {
    if (!businessDate) throw new BadRequestException('businessDate is required');
    try { return await this.getRule.execute(ruleCode, businessDate); }
    catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error && error.message.startsWith('Regulatory rule not found')) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
