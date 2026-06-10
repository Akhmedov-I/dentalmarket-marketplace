import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { CartService } from '../../cart/services/cart.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateShipmentDto } from '../dto/update-shipment.dto';
import { OrderStatus, FulfilmentStatus, ShipmentStatus, PaymentStatus, PaymentMethod, CertStatus } from '@prisma/client';
import { PaymentsService } from '../../payments/services/payments.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Place an order from the user's cart.
   * Performs inventory checks, reserves stock, creates Order/OrderItems/Payment/Shipment in a transaction.
   */
  async createOrder(buyerId: string, dto: CreateOrderDto) {
    // 1. Verify addresses belong to the buyer
    const shippingAddr = await this.prisma.address.findFirst({
      where: { id: dto.shippingAddressId, userId: buyerId },
    });
    if (!shippingAddr) {
      throw new BadRequestException('Shipping address not found or does not belong to you');
    }

    const billingAddr = await this.prisma.address.findFirst({
      where: { id: dto.billingAddressId, userId: buyerId },
    });
    if (!billingAddr) {
      throw new BadRequestException('Billing address not found or does not belong to you');
    }

    // 2. Fetch cart
    const cart = await this.prisma.cart.findFirst({
      where: { userId: buyerId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    seller: true,
                  },
                },
                inventory: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    // 3. Perform inventory and validation check under transaction
    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0n;

      // Validate stock and calculate totals
      for (const item of cart.items) {
        const variant = item.variant;
        const availableStock = variant.inventory?.quantityAvailable ?? 0;

        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for item ${variant.product.title} (${variant.name}). Available: ${availableStock}, requested: ${item.quantity}`,
          );
        }

        // Calculate price snapshot
        const price = variant.priceOverride !== null ? variant.priceOverride : variant.product.basePrice;
        subtotal += price * BigInt(item.quantity);

        // Reserve stock
        await tx.inventory.update({
          where: { variantId: variant.id },
          data: {
            quantityAvailable: { decrement: item.quantity },
            quantityReserved: { increment: item.quantity },
          },
        });
      }

      // Shipping & tax total stubs
      const shippingTotal = 20000n; // 200 UZS / minor units
      const taxTotal = 0n;
      const grandTotal = subtotal + shippingTotal + taxTotal;

      // 4. Generate orderNumber (ORD-YYYYMMDD-XXXX)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const count = await tx.order.count({
        where: {
          placedAt: { gte: todayStart, lte: todayEnd },
        },
      });

      const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const seq = (count + 1).toString().padStart(4, '0');
      const orderNumber = `ORD-${yyyymmdd}-${seq}`;

      // 5. Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          buyerId,
          status: OrderStatus.pending_payment,
          currency: dto.currency,
          subtotal,
          shippingTotal,
          taxTotal,
          grandTotal,
          shippingAddressId: dto.shippingAddressId,
          billingAddressId: dto.billingAddressId,
        },
      });

      // 6. Create OrderItems
      for (const item of cart.items) {
        const variant = item.variant;
        const price = variant.priceOverride !== null ? variant.priceOverride : variant.product.basePrice;
        const commissionBps = variant.product.seller.commissionRateBps || 500; // default 5%

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: variant.id,
            sellerId: variant.product.sellerId,
            quantity: item.quantity,
            unitPrice: price,
            lineTotal: price * BigInt(item.quantity),
            commissionBpsSnapshot: commissionBps,
            fulfilmentStatus: FulfilmentStatus.pending,
          },
        });
      }

      // 7. Clear user cart
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      // 8. Create Payment record (initiated)
      const method = dto.provider === 'bank_transfer' ? PaymentMethod.bank_transfer : PaymentMethod.card;
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: dto.provider,
          amount: grandTotal,
          currency: dto.currency,
          status: PaymentStatus.initiated,
          method,
          idempotencyKey: `capt_${order.id}_${Date.now()}`,
        },
      });

      // 9. Create Shipment record (preparing)
      await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier: 'TBD',
          status: ShipmentStatus.preparing,
        },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
          payment: true,
          shipment: true,
        },
      });
    });
  }

  /**
   * Confirm receipt of an order by the buyer.
   * Updates statuses and triggers releases of all escrow holds.
   */
  async confirmDelivery(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shipment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.buyerId !== buyerId) {
      throw new UnauthorizedException('You do not own this order');
    }
    if (order.status !== OrderStatus.shipped && order.status !== OrderStatus.delivered) {
      throw new BadRequestException('Order cannot be confirmed; it has not been shipped or delivered');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.completed },
      });

      // 2. Update Shipment status
      await tx.shipment.update({
        where: { orderId },
        data: {
          status: ShipmentStatus.delivered,
          deliveredAt: new Date(),
        },
      });

      // 3. For each order item, update status and release escrow
      for (const item of order.items) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            fulfilmentStatus: FulfilmentStatus.delivered,
            deliveryConfirmedAt: new Date(),
          },
        });

        // Find associated escrow hold
        const hold = await tx.escrowHold.findFirst({
          where: { orderItemId: item.id },
        });

        if (hold && hold.status === 'held') {
          await this.paymentsService.releaseEscrow(tx, hold.id, buyerId);
        }
      }

      return updatedOrder;
    });
  }

  /**
   * Cancel an unpaid order.
   * Returns reserved stock back to available stock.
   */
  async cancelOrder(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.buyerId !== buyerId) {
      throw new UnauthorizedException('You do not own this order');
    }
    if (order.status !== OrderStatus.pending_payment) {
      throw new BadRequestException('Only unpaid orders can be cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Transition Order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.cancelled },
      });

      // 2. Return reserved stock to available
      for (const item of order.items) {
        await tx.inventory.update({
          where: { variantId: item.variantId },
          data: {
            quantityAvailable: { increment: item.quantity },
            quantityReserved: { decrement: item.quantity },
          },
        });
      }

      // 3. Update payment status
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: PaymentStatus.failed },
        });
      }

      return updatedOrder;
    });
  }

  /**
   * Get all orders for the buyer
   */
  async getBuyerOrders(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
        payment: true,
        shipment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single order details
   */
  async getOrderDetails(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
        payment: true,
        shipment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.buyerId !== buyerId) {
      throw new UnauthorizedException('You do not own this order');
    }

    return order;
  }

  /**
   * Update shipment details (e.g. for sellers/admin)
   */
  async updateShipment(orderId: string, dto: UpdateShipmentDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found for this order');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedShipment = await tx.shipment.update({
        where: { orderId },
        data: {
          carrier: dto.carrier,
          trackingNumber: dto.trackingNumber || shipment.trackingNumber,
          status: dto.status,
          shippedAt: dto.status === ShipmentStatus.shipped ? new Date() : shipment.shippedAt,
          deliveredAt: dto.status === ShipmentStatus.delivered ? new Date() : shipment.deliveredAt,
          estimatedDelivery: dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : shipment.estimatedDelivery,
        },
      });

      // Also update overall Order status accordingly
      let newOrderStatus: OrderStatus | null = null;
      if (dto.status === ShipmentStatus.shipped) {
        newOrderStatus = OrderStatus.shipped;
      } else if (dto.status === ShipmentStatus.delivered) {
        newOrderStatus = OrderStatus.delivered;
      }

      if (newOrderStatus) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: newOrderStatus },
        });

        await tx.orderItem.updateMany({
          where: { orderId },
          data: {
            fulfilmentStatus: dto.status === ShipmentStatus.shipped ? FulfilmentStatus.shipped : FulfilmentStatus.delivered,
          },
        });
      }

      return updatedShipment;
    });
  }
}
