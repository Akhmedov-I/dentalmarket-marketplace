import { Module } from '@nestjs/common';
import { ReportingService } from './services/reporting.service';
import { ReportingController } from './controllers/reporting.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
