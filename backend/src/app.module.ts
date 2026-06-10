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
import { DisputesModule } from './modules/disputes/disputes.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { HealthModule } from './shared/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { WorkersModule } from './workers/workers.module';
import { SearchModule } from './modules/search/search.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { ProvidersModule } from './shared/providers/providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    StorageModule,
    ProvidersModule,
    FinanceModule,
    AuthModule,
    CertificationModule,
    CatalogModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    PaymentsModule,
    DisputesModule,
    ReviewsModule,
    HealthModule,
    AdminModule,
    WorkersModule,
    SearchModule,
    NotificationsModule,
    ReportingModule,
  ],
})
export class AppModule {}
