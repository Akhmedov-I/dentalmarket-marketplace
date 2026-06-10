import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { LedgerDirection, LedgerEntryType, LedgerAccount, EscrowStatus } from '@prisma/client';

export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

/** Helper: convert BigInt to string for JSON serialisation safety. */
function bigStr(val: bigint | number | null | undefined): string {
  if (val === null || val === undefined) return '0';
  return val.toString();
}

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // SELLER REPORTS
  // ---------------------------------------------------------------------------

  /**
   * Financial report for a single seller: gross sales, net of commission,
   * units sold, AOV, escrow held/released, payouts, refunds.
   */
  async getSellerFinancials(sellerId: string, dateRange: DateRange) {
    const dateFilter = this.buildDateFilter(dateRange, 'createdAt');

    // --- Gross sales & units from order items ---
    const orderItemAgg = await this.prisma.orderItem.aggregate({
      where: {
        sellerId,
        ...dateFilter,
      },
      _sum: { lineTotal: true, quantity: true },
      _count: { id: true },
    });

    const grossSales = orderItemAgg._sum.lineTotal ?? 0n;
    const totalUnits = orderItemAgg._sum.quantity ?? 0;
    const orderItemCount = orderItemAgg._count.id;
    const aov = orderItemCount > 0
      ? grossSales / BigInt(orderItemCount)
      : 0n;

    // --- Commission deducted (ledger entries of type 'commission' related to seller) ---
    const commissionAgg = await this.prisma.ledgerEntry.aggregate({
      where: {
        entryType: LedgerEntryType.commission,
        account: LedgerAccount.platform_revenue,
        direction: LedgerDirection.credit,
        relatedPartyId: sellerId,
        ...dateFilter,
      },
      _sum: { amount: true },
    });
    const totalCommission = commissionAgg._sum.amount ?? 0n;
    const netOfCommission = grossSales - totalCommission;

    // --- Escrow held vs released ---
    const escrowHeld = await this.prisma.escrowHold.aggregate({
      where: {
        orderItem: { sellerId },
        status: EscrowStatus.held,
        ...dateFilter,
      },
      _sum: { amount: true },
    });

    const escrowReleased = await this.prisma.escrowHold.aggregate({
      where: {
        orderItem: { sellerId },
        status: EscrowStatus.released,
        ...dateFilter,
      },
      _sum: { amount: true },
    });

    // --- Payouts ---
    const payoutAgg = await this.prisma.payout.aggregate({
      where: {
        sellerId,
        status: 'paid',
        ...dateFilter,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    // --- Refunds (items belonging to this seller) ---
    const refundAgg = await this.prisma.refund.aggregate({
      where: {
        payment: {
          order: {
            items: { some: { sellerId } },
          },
        },
        status: 'completed',
        ...dateFilter,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    return {
      sellerId,
      dateRange: this.serializeDateRange(dateRange),
      grossSales: bigStr(grossSales),
      totalCommission: bigStr(totalCommission),
      netOfCommission: bigStr(netOfCommission),
      totalUnits,
      orderItemCount,
      averageOrderValue: bigStr(aov),
      escrowHeld: bigStr(escrowHeld._sum.amount),
      escrowReleased: bigStr(escrowReleased._sum.amount),
      totalPayouts: bigStr(payoutAgg._sum.amount),
      payoutCount: payoutAgg._count.id,
      totalRefunds: bigStr(refundAgg._sum.amount),
      refundCount: refundAgg._count.id,
    };
  }

  // ---------------------------------------------------------------------------
  // CUSTOMER REPORTS
  // ---------------------------------------------------------------------------

  /**
   * Order history totals and refund status for a customer.
   */
  async getCustomerFinancials(userId: string, dateRange: DateRange) {
    const dateFilter = this.buildDateFilter(dateRange, 'createdAt');

    const orderAgg = await this.prisma.order.aggregate({
      where: {
        buyerId: userId,
        ...dateFilter,
      },
      _sum: { grandTotal: true },
      _count: { id: true },
    });

    const refundAgg = await this.prisma.refund.aggregate({
      where: {
        payment: { order: { buyerId: userId } },
        status: 'completed',
        ...dateFilter,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const pendingRefunds = await this.prisma.refund.aggregate({
      where: {
        payment: { order: { buyerId: userId } },
        status: { in: ['requested', 'approved', 'processing'] },
        ...dateFilter,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    return {
      userId,
      dateRange: this.serializeDateRange(dateRange),
      totalOrders: orderAgg._count.id,
      totalSpent: bigStr(orderAgg._sum.grandTotal),
      totalRefunded: bigStr(refundAgg._sum.amount),
      refundCount: refundAgg._count.id,
      pendingRefundAmount: bigStr(pendingRefunds._sum.amount),
      pendingRefundCount: pendingRefunds._count.id,
    };
  }

  // ---------------------------------------------------------------------------
  // PLATFORM / ADMIN REPORTS
  // ---------------------------------------------------------------------------

  /**
   * Platform-level financial metrics: GMV, net revenue, take rate,
   * transaction count, escrow float, active sellers/buyers.
   */
  async getPlatformFinancials(dateRange: DateRange) {
    const dateFilter = this.buildDateFilter(dateRange, 'createdAt');

    // --- GMV (sum of all order grandTotals) ---
    const gmvAgg = await this.prisma.order.aggregate({
      where: dateFilter,
      _sum: { grandTotal: true },
      _count: { id: true },
    });
    const gmv = gmvAgg._sum.grandTotal ?? 0n;
    const transactionCount = gmvAgg._count.id;

    // --- Net revenue (platform_revenue credits = commissions) ---
    const revenueAgg = await this.prisma.ledgerEntry.aggregate({
      where: {
        account: LedgerAccount.platform_revenue,
        direction: LedgerDirection.credit,
        ...dateFilter,
      },
      _sum: { amount: true },
    });
    const netRevenue = revenueAgg._sum.amount ?? 0n;

    // --- Take rate ---
    const takeRateBps = gmv > 0n
      ? Number((netRevenue * 10000n) / gmv)
      : 0;

    // --- Escrow float (currently held) ---
    const escrowFloat = await this.prisma.escrowHold.aggregate({
      where: { status: EscrowStatus.held },
      _sum: { amount: true },
    });

    // --- Active sellers (sellers with at least one order item in range) ---
    const activeSellers = await this.prisma.orderItem.groupBy({
      by: ['sellerId'],
      where: dateFilter,
    });

    // --- Active buyers (buyers with at least one order in range) ---
    const activeBuyers = await this.prisma.order.groupBy({
      by: ['buyerId'],
      where: dateFilter,
    });

    // --- Refunds ---
    const refundAgg = await this.prisma.refund.aggregate({
      where: {
        status: 'completed',
        ...dateFilter,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    return {
      dateRange: this.serializeDateRange(dateRange),
      gmv: bigStr(gmv),
      netRevenue: bigStr(netRevenue),
      takeRateBps,
      transactionCount,
      escrowFloat: bigStr(escrowFloat._sum.amount),
      activeSellers: activeSellers.length,
      activeBuyers: activeBuyers.length,
      totalRefunds: bigStr(refundAgg._sum.amount),
      refundCount: refundAgg._count.id,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private buildDateFilter(
    dateRange: DateRange,
    field: string,
  ): Record<string, any> {
    if (!dateRange.startDate && !dateRange.endDate) return {};

    const filter: Record<string, any> = {};
    if (dateRange.startDate || dateRange.endDate) {
      filter[field] = {};
      if (dateRange.startDate) filter[field].gte = dateRange.startDate;
      if (dateRange.endDate) filter[field].lte = dateRange.endDate;
    }
    return filter;
  }

  private serializeDateRange(dateRange: DateRange) {
    return {
      startDate: dateRange.startDate?.toISOString() ?? null,
      endDate: dateRange.endDate?.toISOString() ?? null,
    };
  }
}
