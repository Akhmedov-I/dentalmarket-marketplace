import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { LedgerService } from '@shared/finance/ledger.service';
import { EscrowStatus, PaymentStatus, OrderStatus, LedgerAccount, LedgerEntryType, FulfilmentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Capture an initiated payment.
   * Sets payment status to captured, order status to paid, reserves inventories to sold,
   * creates EscrowHolds, and logs double-entry ledger records.
   */
  async capturePayment(tx: Prisma.TransactionClient, orderId: string, providerPaymentId: string) {
    const payment = await tx.payment.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (payment.status === PaymentStatus.captured) {
      return payment; // Already captured
    }

    // 1. Update Payment status
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.captured,
        providerPaymentId,
      },
    });

    // 2. Update Order status to paid
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.paid },
    });

    // 3. Update inventory: subtract reserved quantity permanently (sold)
    for (const item of payment.order.items) {
      await tx.inventory.update({
        where: { variantId: item.variantId },
        data: {
          quantityReserved: { decrement: item.quantity },
        },
      });

      // 4. Create EscrowHold record for each order item
      await tx.escrowHold.create({
        data: {
          paymentId: payment.id,
          orderItemId: item.id,
          amount: item.lineTotal,
          currency: payment.currency,
          status: EscrowStatus.held,
          autoReleaseAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      });
    }

    // 5. Write double-entry Ledger logs
    const grandTotal = payment.amount;

    // capture debit/credit: debit processor, credit buyer
    await this.ledgerService.recordDoubleEntry(
      tx,
      {
        paymentId: payment.id,
        entryType: LedgerEntryType.capture,
        account: LedgerAccount.processor,
        amount: grandTotal,
        currency: payment.currency,
      },
      {
        paymentId: payment.id,
        entryType: LedgerEntryType.capture,
        account: LedgerAccount.buyer,
        amount: grandTotal,
        currency: payment.currency,
      },
    );

    // escrow_hold debit/credit: debit buyer, credit escrow
    await this.ledgerService.recordDoubleEntry(
      tx,
      {
        paymentId: payment.id,
        entryType: LedgerEntryType.escrow_hold,
        account: LedgerAccount.buyer,
        amount: grandTotal,
        currency: payment.currency,
      },
      {
        paymentId: payment.id,
        entryType: LedgerEntryType.escrow_hold,
        account: LedgerAccount.escrow,
        amount: grandTotal,
        currency: payment.currency,
      },
    );

    return updatedPayment;
  }

  /**
   * Release escrow for a specific EscrowHold record.
   * Splits funds: pays out to seller bank account ledger minus platform commission.
   */
  async releaseEscrow(tx: Prisma.TransactionClient, escrowHoldId: string, actorId: string) {
    const hold = await tx.escrowHold.findUnique({
      where: { id: escrowHoldId },
      include: {
        orderItem: true,
      },
    });

    if (!hold) {
      throw new NotFoundException('Escrow hold not found');
    }

    if (hold.status !== EscrowStatus.held) {
      return hold; // Already released or refunded
    }

    // 1. Update EscrowHold status to released
    const updatedHold = await tx.escrowHold.update({
      where: { id: escrowHoldId },
      data: {
        status: EscrowStatus.released,
        releasedAt: new Date(),
      },
    });

    // 2. Calculate commission and payout splits
    const bps = BigInt(hold.orderItem.commissionBpsSnapshot);
    const commission = (hold.amount * bps) / 10000n;
    const payout = hold.amount - commission;

    // 3. Record double entry: Move payout from escrow to seller payable
    if (payout > 0n) {
      await this.ledgerService.recordDoubleEntry(
        tx,
        {
          paymentId: hold.paymentId,
          entryType: LedgerEntryType.escrow_release,
          account: LedgerAccount.escrow,
          amount: payout,
          currency: hold.currency,
        },
        {
          paymentId: hold.paymentId,
          entryType: LedgerEntryType.escrow_release,
          account: LedgerAccount.seller_payable,
          amount: payout,
          currency: hold.currency,
          relatedPartyId: hold.orderItem.sellerId,
        },
      );
    }

    // 4. Record double entry: Move commission from escrow to platform revenue
    if (commission > 0n) {
      await this.ledgerService.recordDoubleEntry(
        tx,
        {
          paymentId: hold.paymentId,
          entryType: LedgerEntryType.commission,
          account: LedgerAccount.escrow,
          amount: commission,
          currency: hold.currency,
        },
        {
          paymentId: hold.paymentId,
          entryType: LedgerEntryType.commission,
          account: LedgerAccount.platform_revenue,
          amount: commission,
          currency: hold.currency,
        },
      );
    }

    // 5. Create Payout scheduled record
    if (payout > 0n) {
      await tx.payout.create({
        data: {
          sellerId: hold.orderItem.sellerId,
          escrowHoldId: hold.id,
          amount: payout,
          currency: hold.currency,
          status: 'scheduled',
        },
      });
    }

    return updatedHold;
  }

  /**
   * Refund an order item before delivery.
   * Returns hold money from escrow back to buyer via processor.
   */
  async refundOrderItem(tx: Prisma.TransactionClient, orderItemId: string, actorId: string, reason: string) {
    const hold = await tx.escrowHold.findFirst({
      where: { orderItemId, status: EscrowStatus.held },
      include: {
        orderItem: {
          include: { order: true },
        },
      },
    });

    if (!hold) {
      throw new NotFoundException('Active escrow hold not found for this order item');
    }

    // 1. Update EscrowHold status to refunded
    await tx.escrowHold.update({
      where: { id: hold.id },
      data: {
        status: EscrowStatus.refunded,
        releasedAt: new Date(),
      },
    });

    // 2. Update OrderItem fulfilmentStatus to cancelled
    await tx.orderItem.update({
      where: { id: orderItemId },
      data: {
        fulfilmentStatus: FulfilmentStatus.cancelled,
      },
    });

    // 3. Create Refund record
    const refund = await tx.refund.create({
      data: {
        paymentId: hold.paymentId,
        orderItemId,
        amount: hold.amount,
        currency: hold.currency,
        reason,
        status: 'completed',
        processedBy: actorId,
      },
    });

    // 4. Record ledger entries: escrow -> buyer, buyer -> processor
    // Move from escrow back to buyer
    await this.ledgerService.recordDoubleEntry(
      tx,
      {
        paymentId: hold.paymentId,
        entryType: LedgerEntryType.refund,
        account: LedgerAccount.escrow,
        amount: hold.amount,
        currency: hold.currency,
      },
      {
        paymentId: hold.paymentId,
        entryType: LedgerEntryType.refund,
        account: LedgerAccount.buyer,
        amount: hold.amount,
        currency: hold.currency,
      },
    );

    // Move from buyer back to processor
    await this.ledgerService.recordDoubleEntry(
      tx,
      {
        paymentId: hold.paymentId,
        entryType: LedgerEntryType.refund,
        account: LedgerAccount.buyer,
        amount: hold.amount,
        currency: hold.currency,
      },
      {
        paymentId: hold.paymentId,
        entryType: LedgerEntryType.refund,
        account: LedgerAccount.processor,
        amount: hold.amount,
        currency: hold.currency,
      },
    );

    // 5. Update overall Order status if all items are cancelled/refunded
    const siblingItems = await tx.orderItem.findMany({
      where: { orderId: hold.orderItem.orderId },
    });

    const allRefunded = siblingItems.every((item) => item.fulfilmentStatus === FulfilmentStatus.cancelled);
    if (allRefunded) {
      await tx.order.update({
        where: { id: hold.orderItem.orderId },
        data: { status: OrderStatus.refunded },
      });
    }

    return refund;
  }

  /**
   * Helper to retrieve net account balance in ledger
   */
  async getLedgerAccountBalance(account: LedgerAccount, currency: string): Promise<number> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { account, currency },
    });

    let balance = 0n;
    for (const entry of entries) {
      if (entry.direction === 'debit') {
        balance += entry.amount;
      } else {
        balance -= entry.amount;
      }
    }

    return Number(balance) / 100;
  }
}
