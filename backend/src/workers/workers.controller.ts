import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';
import { Roles } from '../modules/auth/decorators/roles.decorator';
import { CertExpiryWorker } from './cert-expiry.worker';
import { EscrowAutoReleaseWorker } from './escrow-auto-release.worker';
import { ReconciliationWorker } from './reconciliation.worker';

@ApiTags('Admin Workers')
@ApiBearerAuth()
@Controller('admin/workers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WorkersController {
  constructor(
    private readonly certExpiryWorker: CertExpiryWorker,
    private readonly escrowAutoReleaseWorker: EscrowAutoReleaseWorker,
    private readonly reconciliationWorker: ReconciliationWorker,
  ) {}

  @Post('cert-expiry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger certification expiry scan',
    description:
      'Scans all verified certifications for upcoming or past expiry. ' +
      'Sends warnings for certs expiring within 3 days and expires overdue ones, ' +
      'auto-pausing affected products and sellers.',
  })
  @ApiResponse({ status: 200, description: 'Cert expiry scan result' })
  async triggerCertExpiry() {
    return this.certExpiryWorker.run();
  }

  @Post('escrow-release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger escrow auto-release',
    description:
      'Releases all matured escrow holds, creates commission + seller_payable ledger entries, ' +
      'and marks orders as completed when all items are fulfilled.',
  })
  @ApiResponse({ status: 200, description: 'Escrow auto-release result' })
  async triggerEscrowRelease() {
    return this.escrowAutoReleaseWorker.run();
  }

  @Post('reconciliation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger ledger reconciliation',
    description:
      'Runs the full double-entry ledger reconciliation check. ' +
      'Reports unbalanced payments and escrow mismatches.',
  })
  @ApiResponse({ status: 200, description: 'Reconciliation report' })
  async triggerReconciliation() {
    return this.reconciliationWorker.run();
  }
}
