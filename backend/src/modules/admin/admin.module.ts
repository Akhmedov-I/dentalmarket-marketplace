import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './services/admin.service';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminSellersController } from './controllers/admin-sellers.controller';
import { AdminDisputesController } from './controllers/admin-disputes.controller';
import { AdminRefundsController } from './controllers/admin-refunds.controller';
import { AdminPayoutsController } from './controllers/admin-payouts.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminCategoriesController } from './controllers/admin-categories.controller';
import { AdminStandardsController } from './controllers/admin-standards.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminUsersController,
    AdminSellersController,
    AdminDisputesController,
    AdminRefundsController,
    AdminPayoutsController,
    AdminAuditController,
    AdminCategoriesController,
    AdminStandardsController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
