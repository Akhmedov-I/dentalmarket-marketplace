import { Module } from '@nestjs/common';
import { CatalogService } from './services/catalog.service';
import { CatalogController } from './controllers/catalog.controller';
import { SellerCatalogController } from './controllers/seller-catalog.controller';
import { AdminCatalogController } from './controllers/admin-catalog.controller';
import { AuthModule } from '../auth/auth.module';
import { CertificationModule } from '../certification/certification.module';

@Module({
  imports: [AuthModule, CertificationModule],
  controllers: [CatalogController, SellerCatalogController, AdminCatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
