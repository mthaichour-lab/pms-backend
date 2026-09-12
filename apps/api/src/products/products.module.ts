import { Module } from '@nestjs/common';
import { PostgresInvestmentProductRepository } from '../../../../src/infrastructure/persistence/postgres-investment-product.repository.js';
import { PostgresProductTermsRepository } from '../../../../src/infrastructure/persistence/postgres-product-terms.repository.js';
import { PostgresProductReferenceRepository } from '../../../../src/infrastructure/persistence/postgres-product-reference.repository.js';
import { ManageInvestmentProduct } from '../../../../src/modules/products/application/manage-investment-product.js';
import { ManageProductTerms } from '../../../../src/modules/products/application/manage-product-terms.js';
import { ManageProductReferences } from '../../../../src/modules/products/application/manage-product-references.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { ProductsController } from './products.controller.js';
import { MANAGE_INVESTMENT_PRODUCT, MANAGE_PRODUCT_REFERENCES, MANAGE_PRODUCT_TERMS } from './products.tokens.js';

@Module({
  controllers: [ProductsController],
  providers: [{
    provide: MANAGE_INVESTMENT_PRODUCT,
    inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) => new ManageInvestmentProduct(new PostgresInvestmentProductRepository(database.pool)),
  }, {
    provide: MANAGE_PRODUCT_REFERENCES,
    inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) => new ManageProductReferences(new PostgresProductReferenceRepository(database.pool)),
  }, {
    provide: MANAGE_PRODUCT_TERMS,
    inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) => new ManageProductTerms(new PostgresProductTermsRepository(database.pool)),
  }],
})
export class ProductsModule {}
