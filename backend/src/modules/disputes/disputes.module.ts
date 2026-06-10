import { Module, forwardRef } from '@nestjs/common';
import { DisputesService } from './services/disputes.service';
import { DisputesController } from './controllers/disputes.controller';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
