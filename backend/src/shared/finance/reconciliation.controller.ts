import { Controller, Post, UseGuards } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';

@Controller('finance/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'finance')
export class ReconciliationController {
  constructor(private readonly recService: ReconciliationService) {}

  @Post('run')
  async runReconciliation() {
    return this.recService.runReconciliation();
  }
}
