import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { LedgerAccount, EscrowStatus } from '@prisma/client';

export interface ReconciliationReport {
  runAt: Date;
  success: boolean;
  unbalancedPaymentIds: string[];
  escrowMismatches: { paymentId: string; ledgerEscrow: number; holdsEscrow: number }[];
  totalCheckedPayments: number;
}

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Performs financial audits on the append-only ledger entries.
   * Asserts double-entry zero-sum rules and escrow holds balance alignment.
   */
  async runReconciliation(): Promise<ReconciliationReport> {
    // 1. Fetch all ledger entries and active escrow holds
    const entries = await this.prisma.ledgerEntry.findMany();
    const escrowHolds = await this.prisma.escrowHold.findMany({
      where: { status: EscrowStatus.held },
    });

    const paymentIds = new Set<string>();
    const paymentSums: Record<string, bigint> = {};
    const paymentEscrowLedger: Record<string, bigint> = {};

    // 2. Aggregate ledger amounts per payment
    for (const entry of entries) {
      paymentIds.add(entry.paymentId);

      // Total balance (debits should match credits)
      if (!paymentSums[entry.paymentId]) {
        paymentSums[entry.paymentId] = 0n;
      }
      if (entry.direction === 'debit') {
        paymentSums[entry.paymentId] += entry.amount;
      } else {
        paymentSums[entry.paymentId] -= entry.amount;
      }

      // Escrow ledger account balance
      if (entry.account === LedgerAccount.escrow) {
        if (!paymentEscrowLedger[entry.paymentId]) {
          paymentEscrowLedger[entry.paymentId] = 0n;
        }
        if (entry.direction === 'debit') {
          paymentEscrowLedger[entry.paymentId] += entry.amount;
        } else {
          paymentEscrowLedger[entry.paymentId] -= entry.amount;
        }
      }
    }

    // 3. Aggregate active escrow hold amounts per payment
    const paymentEscrowHolds: Record<string, bigint> = {};
    for (const hold of escrowHolds) {
      paymentIds.add(hold.paymentId);
      if (!paymentEscrowHolds[hold.paymentId]) {
        paymentEscrowHolds[hold.paymentId] = 0n;
      }
      paymentEscrowHolds[hold.paymentId] += hold.amount;
    }

    // 4. Perform double-entry checks
    const unbalancedPaymentIds: string[] = [];
    const escrowMismatches: { paymentId: string; ledgerEscrow: number; holdsEscrow: number }[] = [];

    for (const paymentId of paymentIds) {
      // Invariant 1: Total payment debits must equal credits (net sum should be 0)
      const netSum = paymentSums[paymentId] || 0n;
      if (netSum !== 0n) {
        unbalancedPaymentIds.push(paymentId);
      }

      // Invariant 2: Net ledger escrow account balance plus total active escrow holds plus shippingTotal must equal 0
      const ledgerEscrowBal = paymentEscrowLedger[paymentId] || 0n;
      const holdsEscrowTotal = paymentEscrowHolds[paymentId] || 0n;
      
      const paymentRecord = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      });
      const shippingTotal = paymentRecord?.order?.shippingTotal || 0n;

      if (ledgerEscrowBal + holdsEscrowTotal + shippingTotal !== 0n) {
        escrowMismatches.push({
          paymentId,
          ledgerEscrow: Number(ledgerEscrowBal) / 100,
          holdsEscrow: Number(holdsEscrowTotal) / 100,
        });
      }
    }

    const success = unbalancedPaymentIds.length === 0 && escrowMismatches.length === 0;

    return {
      runAt: new Date(),
      success,
      unbalancedPaymentIds,
      escrowMismatches,
      totalCheckedPayments: paymentIds.size,
    };
  }
}
