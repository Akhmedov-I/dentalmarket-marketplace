import { Global, Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { AuthModule } from '../../modules/auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [ReconciliationController],
  providers: [LedgerService, ReconciliationService],
  exports: [LedgerService, ReconciliationService],
})
export class FinanceModule {}
