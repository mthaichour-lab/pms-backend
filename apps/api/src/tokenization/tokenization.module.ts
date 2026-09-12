import { Module } from '@nestjs/common';
import { HttpTokenVaultAdapter } from '../../../../src/infrastructure/tokenization/http-token-vault.adapter.js';
import { ManageTokenization } from '../../../../src/modules/tokenization/application/token-vault.js';
import { TokenizationController } from './tokenization.controller.js';
import { MANAGE_TOKENIZATION } from './tokenization.tokens.js';

@Module({
  controllers: [TokenizationController],
  providers: [{
    provide: MANAGE_TOKENIZATION,
    useFactory: () => new ManageTokenization(new HttpTokenVaultAdapter(
      required('TOKEN_VAULT_URL'), required('TOKEN_VAULT_WORKLOAD_TOKEN'),
    )),
  }],
})
export class TokenizationModule {}

function required(name: string): string {
  const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value;
}
