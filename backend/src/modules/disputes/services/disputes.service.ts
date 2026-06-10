import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { CreateDisputeDto } from '../dto/create-dispute.dto';
import { ResolveDisputeDto } from '../dto/resolve-dispute.dto';
import { DisputeStatus, OrderStatus, EscrowStatus, FulfilmentStatus } from '@prisma/client';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Raise a new dispute for an order or a specific order item.
   */
  async raiseDispute(buyerId: string, dto: CreateDisputeDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('You do not own this order');
    }

    const allowedStatuses: OrderStatus[] = [
      OrderStatus.paid,
      OrderStatus.processing,
      OrderStatus.shipped,
      OrderStatus.delivered,
    ];

    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException('Only paid, processing, shipped, or delivered orders can be disputed');
    }

    let againstSellerId: string;

    if (dto.orderItemId) {
      const orderItem = order.items.find((item) => item.id === dto.orderItemId);
      if (!orderItem) {
        throw new BadRequestException('Order item not found or does not belong to this order');
      }
      againstSellerId = orderItem.sellerId;

      // Check if there is already an active dispute for this order item
      const existingDispute = await this.prisma.dispute.findFirst({
        where: {
          orderItemId: dto.orderItemId,
          status: {
            in: [DisputeStatus.open, DisputeStatus.under_review, DisputeStatus.awaiting_buyer, DisputeStatus.awaiting_seller],
          },
        },
      });
      if (existingDispute) {
        throw new BadRequestException('An active dispute already exists for this order item');
      }
    } else {
      if (order.items.length === 0) {
        throw new BadRequestException('Order has no items');
      }
      againstSellerId = order.items[0].sellerId;

      // Check if there is already an active dispute for this order general case
      const existingDispute = await this.prisma.dispute.findFirst({
        where: {
          orderId: dto.orderId,
          orderItemId: null,
          status: {
            in: [DisputeStatus.open, DisputeStatus.under_review, DisputeStatus.awaiting_buyer, DisputeStatus.awaiting_seller],
          },
        },
      });
      if (existingDispute) {
        throw new BadRequestException('An active dispute already exists for this order');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Dispute record (SLA: +3 days)
      const dispute = await tx.dispute.create({
        data: {
          orderId: dto.orderId,
          orderItemId: dto.orderItemId || null,
          raisedBy: buyerId,
          againstSellerId,
          type: dto.type,
          status: DisputeStatus.open,
          slaDueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });

      // 2. Create the first dispute message
      await tx.disputeMessage.create({
        data: {
          disputeId: dispute.id,
          senderId: buyerId,
          body: dto.description,
          attachments: [],
        },
      });

      // 3. Lock Order status to disputed
      await tx.order.update({
        where: { id: dto.orderId },
        data: { status: OrderStatus.disputed },
      });

      return dispute;
    });
  }

  /**
   * Get disputes filtered by user permissions.
   */
  async getDisputes(userId: string, roles: string[]) {
    const conditions = [];

    if (roles.includes('admin') || roles.includes('support')) {
      // Admin and support can see everything
    } else {
      if (roles.includes('seller')) {
        const sellerProfile = await this.prisma.sellerProfile.findUnique({
          where: { userId },
        });
        if (sellerProfile) {
          conditions.push({ againstSellerId: sellerProfile.id });
        }
      }
      if (roles.includes('customer')) {
        conditions.push({ raisedBy: userId });
      }

      if (conditions.length === 0) {
        return [];
      }
    }

    return this.prisma.dispute.findMany({
      where: conditions.length > 0 ? { OR: conditions } : undefined,
      include: {
        order: true,
        raiser: { select: { id: true, email: true } },
        againstSeller: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single dispute details.
   */
  async getDisputeDetails(userId: string, roles: string[], disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            items: true,
          },
        },
        raiser: { select: { id: true, email: true } },
        againstSeller: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    let allowed = false;
    if (roles.includes('admin') || roles.includes('support')) {
      allowed = true;
    } else {
      if (roles.includes('customer') && dispute.raisedBy === userId) {
        allowed = true;
      }
      if (roles.includes('seller')) {
        const sellerProfile = await this.prisma.sellerProfile.findUnique({
          where: { userId },
        });
        if (sellerProfile && dispute.againstSellerId === sellerProfile.id) {
          allowed = true;
        }
      }
    }

    if (!allowed) {
      throw new ForbiddenException('You do not have access to this dispute');
    }

    return dispute;
  }

  /**
   * Post a message in the dispute thread.
   */
  async sendMessage(userId: string, roles: string[], disputeId: string, body: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const terminalStatuses: DisputeStatus[] = [
      DisputeStatus.resolved_release,
      DisputeStatus.resolved_partial_refund,
      DisputeStatus.resolved_full_refund,
      DisputeStatus.closed,
    ];

    if (terminalStatuses.includes(dispute.status)) {
      throw new BadRequestException('Cannot send messages to a closed or resolved dispute');
    }

    let allowed = false;
    if (roles.includes('admin') || roles.includes('support')) {
      allowed = true;
    } else {
      if (roles.includes('customer') && dispute.raisedBy === userId) {
        allowed = true;
      }
      if (roles.includes('seller')) {
        const sellerProfile = await this.prisma.sellerProfile.findUnique({
          where: { userId },
        });
        if (sellerProfile && dispute.againstSellerId === sellerProfile.id) {
          allowed = true;
        }
      }
    }

    if (!allowed) {
      throw new ForbiddenException('You do not have access to this dispute');
    }

    return this.prisma.disputeMessage.create({
      data: {
        disputeId,
        senderId: userId,
        body,
        attachments: [],
      },
      include: {
        sender: { select: { id: true, email: true } },
      },
    });
  }

  /**
   * Admin resolution pathways for a dispute (Arbitrage).
   */
  async resolveDispute(adminId: string, disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const terminalStatuses: DisputeStatus[] = [
      DisputeStatus.resolved_release,
      DisputeStatus.resolved_partial_refund,
      DisputeStatus.resolved_full_refund,
      DisputeStatus.closed,
    ];

    if (terminalStatuses.includes(dispute.status)) {
      throw new BadRequestException('Dispute is already resolved or closed');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.decision === 'release') {
        // Find escrow holds that are held
        const holds = await tx.escrowHold.findMany({
          where: {
            status: EscrowStatus.held,
            orderItemId: dispute.orderItemId ? dispute.orderItemId : undefined,
            payment: dispute.orderItemId
              ? undefined
              : { orderId: dispute.orderId },
          },
        });

        // Release escrow for each hold
        for (const hold of holds) {
          await this.paymentsService.releaseEscrow(tx, hold.id, adminId);
          await tx.orderItem.update({
            where: { id: hold.orderItemId },
            data: {
              fulfilmentStatus: FulfilmentStatus.delivered,
              deliveryConfirmedAt: new Date(),
            },
          });
        }

        // Update Dispute
        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: DisputeStatus.resolved_release,
            resolvedAt: new Date(),
            resolutionNotes: dto.notes,
            assignedAdminId: adminId,
          },
        });
      } else {
        // Decision is refund
        if (dispute.orderItemId) {
          await this.paymentsService.refundOrderItem(tx, dispute.orderItemId, adminId, dto.notes);
        } else {
          // Refund all items that are currently in held escrow
          const holds = await tx.escrowHold.findMany({
            where: {
              status: EscrowStatus.held,
              payment: { orderId: dispute.orderId },
            },
          });

          for (const hold of holds) {
            await this.paymentsService.refundOrderItem(tx, hold.orderItemId, adminId, dto.notes);
          }
        }

        // Update Dispute
        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: DisputeStatus.resolved_full_refund,
            resolvedAt: new Date(),
            resolutionNotes: dto.notes,
            assignedAdminId: adminId,
          },
        });
      }

      // Cleanup Order status based on final items statuses
      const allItems = await tx.orderItem.findMany({
        where: { orderId: dispute.orderId },
      });

      const allCancelledOrDelivered = allItems.every(
        (item) =>
          item.fulfilmentStatus === FulfilmentStatus.cancelled ||
          item.fulfilmentStatus === FulfilmentStatus.delivered,
      );

      if (allCancelledOrDelivered) {
        const anyDelivered = allItems.some((item) => item.fulfilmentStatus === FulfilmentStatus.delivered);
        if (anyDelivered) {
          await tx.order.update({
            where: { id: dispute.orderId },
            data: { status: OrderStatus.completed },
          });
        } else {
          await tx.order.update({
            where: { id: dispute.orderId },
            data: { status: OrderStatus.refunded },
          });
        }
      }

      return tx.dispute.findUnique({
        where: { id: disputeId },
        include: {
          order: true,
          raiser: { select: { id: true, email: true } },
          againstSeller: true,
          messages: true,
        },
      });
    });
  }
}
