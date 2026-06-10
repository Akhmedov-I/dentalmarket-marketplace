import { Injectable, Logger } from '@nestjs/common';
import {
  ReconciliationService,
  ReconciliationReport,
} from '@shared/finance/reconciliation.service';

export interface ReconciliationRunResult {
  runAt: Date;
  report: ReconciliationReport;
  durationMs: number;
}

@Injectable()
export class ReconciliationWorker {
  private readonly logger = new Logger(ReconciliationWorker.name);

  constructor(private readonly reconciliationService: ReconciliationService) {}

  /**
   * Main entry point — delegates to ReconciliationService and logs results.
   * Designed to run nightly (via cron or manual admin trigger).
   */
  async run(): Promise<ReconciliationRunResult> {
    const start = Date.now();
    this.logger.log('Starting nightly reconciliation…');

    try {
      const report = await this.reconciliationService.runReconciliation();
      const durationMs = Date.now() - start;

      if (report.success) {
        this.logger.log(
          `Reconciliation passed — ${report.totalCheckedPayments} payments checked in ${durationMs}ms`,
        );
      } else {
        this.logger.warn(
          `Reconciliation FAILED — unbalanced=${report.unbalancedPaymentIds.length}, ` +
            `escrowMismatches=${report.escrowMismatches.length}, ` +
            `totalChecked=${report.totalCheckedPayments}, duration=${durationMs}ms`,
        );

        if (report.unbalancedPaymentIds.length > 0) {
          this.logger.warn(
            `Unbalanced payment IDs: ${report.unbalancedPaymentIds.join(', ')}`,
          );
        }
        if (report.escrowMismatches.length > 0) {
          this.logger.warn(
            `Escrow mismatches: ${JSON.stringify(report.escrowMismatches)}`,
          );
        }
      }

      return { runAt: report.runAt, report, durationMs };
    } catch (err) {
      const durationMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Reconciliation crashed after ${durationMs}ms: ${msg}`);
      throw err;
    }
  }
}
