import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { LedgerService } from '@shared/finance/ledger.service';
import {
  EscrowStatus,
  LedgerAccount,
  LedgerEntryType,
  OrderStatus,
  FulfilmentStatus,
} from '@prisma/client';

export interface EscrowReleaseRunResult {
  runAt: Date;
  holdsProcessed: number;
  holdsReleased: number;
  ordersCompleted: number;
  errors: string[];
}

@Injectable()
export class EscrowAutoReleaseWorker {
  private readonly logger = new Logger(EscrowAutoReleaseWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Main entry point — release all matured escrow holds.
   * Designed to run every hour (via cron or manual admin trigger).
   */
  async run(): Promise<EscrowReleaseRunResult> {
    const now = new Date();

    const result: EscrowReleaseRunResult = {
      runAt: now,
      holdsProcessed: 0,
      holdsReleased: 0,
      ordersCompleted: 0,
      errors: [],
    };

    this.logger.log('Starting escrow auto-release scan…');

    const dueHolds = await this.prisma.escrowHold.findMany({
      where: {
        status: EscrowStatus.held,
        autoReleaseAt: { lte: now },
      },
      include: {
        payment: { include: { order: true } },
        orderItem: true,
      },
    });

    this.logger.log(`Found ${dueHolds.length} escrow hold(s) due for release`);

    for (const hold of dueHolds) {
      result.holdsProcessed++;

      try {
        await this.prisma.$transaction(async (tx) => {
          // ── 1. Release the escrow hold ──────────────────────────────────
          await tx.escrowHold.update({
            where: { id: hold.id },
            data: {
              status: EscrowStatus.released,
              releasedAt: now,
            },
          });

          // ── 2. Calculate commission and seller payable ──────────────────
          const commissionBps = hold.orderItem.commissionBpsSnapshot;
          const commissionAmount = (hold.amount * BigInt(commissionBps)) / 10000n;
          const sellerPayable = hold.amount - commissionAmount;

          // ── 3. Ledger: escrow_release — debit escrow, credit seller_payable
          await this.ledgerService.recordDoubleEntry(
            tx,
            {
              paymentId: hold.paymentId,
              entryType: LedgerEntryType.escrow_release,
              account: LedgerAccount.escrow,
              amount: sellerPayable,
              currency: hold.currency,
              relatedPartyId: hold.orderItem.sellerId,
            },
            {
              paymentId: hold.paymentId,
              entryType: LedgerEntryType.escrow_release,
              account: LedgerAccount.seller_payable,
              amount: sellerPayable,
              currency: hold.currency,
              relatedPartyId: hold.orderItem.sellerId,
            },
          );

          // ── 4. Ledger: commission — debit escrow, credit platform_revenue
          if (commissionAmount > 0n) {
            await this.ledgerService.recordDoubleEntry(
              tx,
              {
                paymentId: hold.paymentId,
                entryType: LedgerEntryType.commission,
                account: LedgerAccount.escrow,
                amount: commissionAmount,
                currency: hold.currency,
                relatedPartyId: hold.orderItem.sellerId,
              },
              {
                paymentId: hold.paymentId,
                entryType: LedgerEntryType.commission,
                account: LedgerAccount.platform_revenue,
                amount: commissionAmount,
                currency: hold.currency,
                relatedPartyId: hold.orderItem.sellerId,
              },
            );
          }

          // ── 5. Mark order item as delivered (if not already) ────────────
          if (hold.orderItem.fulfilmentStatus !== FulfilmentStatus.delivered) {
            await tx.orderItem.update({
              where: { id: hold.orderItem.id },
              data: {
                fulfilmentStatus: FulfilmentStatus.delivered,
                deliveryConfirmedAt: now,
              },
            });
          }

          result.holdsReleased++;

          // ── 6. Check if ALL items on the order are now delivered ────────
          //       If so, transition the order to 'completed'
          if (hold.payment.order) {
            const order = hold.payment.order;
            if (order.status !== OrderStatus.completed) {
              const pendingItems = await tx.orderItem.count({
                where: {
                  orderId: order.id,
                  fulfilmentStatus: { notIn: [FulfilmentStatus.delivered, FulfilmentStatus.cancelled, FulfilmentStatus.returned] },
                },
              });

              if (pendingItems === 0) {
                await tx.order.update({
                  where: { id: order.id },
                  data: { status: OrderStatus.completed },
                });
                result.ordersCompleted++;
              }
            }
          }
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to release escrow hold ${hold.id}: ${msg}`);
        result.errors.push(`Hold ${hold.id}: ${msg}`);
      }
    }

    this.logger.log(
      `Escrow auto-release complete — processed=${result.holdsProcessed}, ` +
        `released=${result.holdsReleased}, ordersCompleted=${result.ordersCompleted}, ` +
        `errors=${result.errors.length}`,
    );

    return result;
  }
}
