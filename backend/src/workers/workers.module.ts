import { Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module';
import { CertExpiryWorker } from './cert-expiry.worker';
import { EscrowAutoReleaseWorker } from './escrow-auto-release.worker';
import { ReconciliationWorker } from './reconciliation.worker';
import { WorkersController } from './workers.controller';

/**
 * WorkersModule registers all background worker services.
 *
 * Workers are plain Injectable services whose `run()` method can be invoked:
 *   1. Manually via the admin API at POST /admin/workers/*
 *   2. Via @nestjs/schedule cron decorators (add later — see NOTE below)
 *
 * NOTE: @nestjs/schedule is NOT currently in package.json.
 * To enable automatic scheduling:
 *   1. npm install @nestjs/schedule
 *   2. Add ScheduleModule.forRoot() to AppModule imports
 *   3. Uncomment the @Cron decorators on each worker's run() method:
 *        CertExpiryWorker.run()       → @Cron('0 3 * * *')      daily at 03:00
 *        EscrowAutoReleaseWorker.run() → @Cron('0 * * * *')      every hour
 *        ReconciliationWorker.run()    → @Cron('0 2 * * *')      daily at 02:00
 *
 * Dependencies (injected via global modules):
 *   - PrismaService   (from PrismaModule, global)
 *   - LedgerService   (from FinanceModule, global)
 *   - ReconciliationService (from FinanceModule, global)
 */
@Module({
  imports: [AuthModule],
  controllers: [WorkersController],
  providers: [
    CertExpiryWorker,
    EscrowAutoReleaseWorker,
    ReconciliationWorker,
  ],
  exports: [
    CertExpiryWorker,
    EscrowAutoReleaseWorker,
    ReconciliationWorker,
  ],
})
export class WorkersModule {}
