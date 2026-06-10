import { Module } from '@nestjs/common';
import { CertificationService } from './services/certification.service';
import { CertificationController } from './controllers/certification.controller';
import { AdminCertificationController } from './controllers/admin-certification.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CertificationController, AdminCertificationController],
  providers: [CertificationService],
  exports: [CertificationService],
})
export class CertificationModule {}
