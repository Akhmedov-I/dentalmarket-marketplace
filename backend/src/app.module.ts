import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/db/prisma.module';
import { RedisModule } from './shared/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { StorageModule } from './shared/storage/storage.module';
import { CertificationModule } from './modules/certification/certification.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CartModule } from './modules/cart/cart.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { FinanceModule } from './shared/finance/finance.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    StorageModule,
    FinanceModule,
    AuthModule,
    CertificationModule,
    CatalogModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    PaymentsModule,
  ],
})
export class AppModule {}
