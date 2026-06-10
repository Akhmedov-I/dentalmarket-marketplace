import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { CartService } from '../../cart/services/cart.service';
import { PrismaService } from '@shared/db/prisma.service';
import { RedisService } from '@shared/redis/redis.service';
import { LedgerService } from '@shared/finance/ledger.service';
import { ConfigModule } from '@nestjs/config';
import { UserStatus, KycStatus, SellerStatus, ProductStatus, AddressType, OrderStatus, EscrowStatus, PaymentStatus, LedgerAccount, FulfilmentStatus, ShipmentStatus, CartItem } from '@prisma/client';

describe('Orders & Payments Integration Tests', () => {
  let ordersService: OrdersService;
  let paymentsService: PaymentsService;
  let cartService: CartService;
  let prisma: PrismaService;
  let redis: RedisService;

  let buyerUser: any;
  let sellerUser: any;
  let sellerProfile: any;
  let testCategory: any;
  let testProduct: any;
  let testVariant: any;
  let shippingAddress: any;
  let billingAddress: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        OrdersService,
        PaymentsService,
        CartService,
        PrismaService,
        RedisService,
        LedgerService,
      ],
    }).compile();

    ordersService = module.get<OrdersService>(OrdersService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    cartService = module.get<CartService>(CartService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);

    redis.onModuleInit();

    // Clean up
    await cleanup();

    // 1. Create buyer and seller users
    buyerUser = await prisma.user.create({
      data: {
        email: `buyer-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    sellerUser = await prisma.user.create({
      data: {
        email: `seller-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    // 2. Create seller profile with commission bps = 1000 (10%)
    sellerProfile = await prisma.sellerProfile.create({
      data: {
        userId: sellerUser.id,
        legalName: 'Chairs & Lights Ltd',
        taxId: `TX-${Date.now()}`,
        registrationNumber: `REG-${Date.now()}`,
        sellerType: 'manufacturer',
        country: 'UZ',
        commissionRateBps: 1000, // 10%
        kycStatus: KycStatus.approved,
        status: SellerStatus.active,
      },
    });

    // 3. Create addresses
    shippingAddress = await prisma.address.create({
      data: {
        userId: buyerUser.id,
        type: AddressType.shipping,
        recipient: 'Ivan Ivanov',
        line1: '12 Amir Temur Str',
        city: 'Tashkent',
        region: 'Tashkent',
        postalCode: '100000',
        country: 'UZ',
      },
    });

    billingAddress = await prisma.address.create({
      data: {
        userId: buyerUser.id,
        type: AddressType.billing,
        recipient: 'Ivan Ivanov',
        line1: '12 Amir Temur Str',
        city: 'Tashkent',
        region: 'Tashkent',
        postalCode: '100000',
        country: 'UZ',
      },
    });

    // 4. Create category, product, and variant
    testCategory = await prisma.category.create({
      data: {
        slug: `order-cat-${Date.now()}`,
        name: 'Order Test Category',
        nameI18n: { ru: 'Тест Категория Заказы' },
        path: '/order-cat',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        sellerId: sellerProfile.id,
        categoryId: testCategory.id,
        sku: `ORD-TEST-PROD-${Date.now()}`,
        title: 'Polishing Machine',
        description: 'Test chair description',
        brand: 'DentPolish',
        model: 'DP-500',
        basePrice: 500000n, // 5000.00
        currency: 'UZS',
        status: ProductStatus.active,
      },
    });

    testVariant = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        name: 'Model A',
        sku: `ORD-VAR-${Date.now()}`,
        priceOverride: null,
        inventory: {
          create: {
            quantityAvailable: 15,
            quantityReserved: 0,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
    redis.onModuleDestroy();
  });

  async function cleanup() {
    if (prisma) {
      // Use TRUNCATE to bypass append-only triggers on ledger_entries, audit_logs
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE 
          dispute_messages, disputes, reviews, payouts, refunds,
          escrow_holds, ledger_entries, shipments, order_items,
          payments, orders, cart_items
        CASCADE
      `);

      if (testProduct) {
        await prisma.inventory.deleteMany({ where: { variantId: testVariant?.id } });
        await prisma.productVariant.deleteMany({ where: { productId: testProduct.id } });
        await prisma.product.delete({ where: { id: testProduct.id } });
      }

      if (testCategory) {
        await prisma.category.delete({ where: { id: testCategory.id } });
      }

      if (shippingAddress) {
        await prisma.address.deleteMany({ where: { id: { in: [shippingAddress.id, billingAddress?.id].filter(Boolean) } } });
      }

      if (sellerProfile) {
        await prisma.sellerProfile.delete({ where: { id: sellerProfile.id } });
      }

      if (buyerUser) {
        await prisma.user.deleteMany({ where: { id: { in: [buyerUser.id, sellerUser?.id].filter(Boolean) } } });
      }
    }
  }

  describe('Inventory Reservation & Order Placement', () => {
    it('should place an order, clear cart, and reserve variant inventory', async () => {
      // 1. Add item to cart
      await cartService.addItem(buyerUser.id, undefined, {
        variantId: testVariant.id,
        quantity: 3,
      });

      // Check stock before
      let inv = await prisma.inventory.findUnique({ where: { variantId: testVariant.id } });
      expect(inv?.quantityAvailable).toBe(15);
      expect(inv?.quantityReserved).toBe(0);

      // 2. Place order
      const order = await ordersService.createOrder(buyerUser.id, {
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
        currency: 'UZS',
        provider: 'payme',
      });

      expect(order).toBeDefined();
      expect(order?.status).toBe(OrderStatus.pending_payment);
      expect(order?.orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
      expect(order?.items).toHaveLength(1);
      expect(order?.items[0].quantity).toBe(3);
      expect(Number(order?.items[0].unitPrice) / 100).toBe(5000); // 5000.00
      expect(order?.items[0].commissionBpsSnapshot).toBe(1000); // 10%
      expect(order?.grandTotal).toBe(1500000n + 20000n); // 15000.00 (items) + 200.00 (shipping) = 15200.00 UZS

      // 3. Check stock after (should be reserved)
      inv = await prisma.inventory.findUnique({ where: { variantId: testVariant.id } });
      expect(inv?.quantityAvailable).toBe(12);
      expect(inv?.quantityReserved).toBe(3);

      // 4. Cart should be cleared
      const cart = await cartService.getCart(buyerUser.id);
      expect(cart.items).toHaveLength(0);
    });

    it('should cancel an unpaid order and return reserved inventory to available', async () => {
      // Create another order for this test
      await cartService.addItem(buyerUser.id, undefined, {
        variantId: testVariant.id,
        quantity: 2,
      });

      const order = await ordersService.createOrder(buyerUser.id, {
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
        currency: 'UZS',
        provider: 'payme',
      });

      let inv = await prisma.inventory.findUnique({ where: { variantId: testVariant.id } });
      expect(inv?.quantityAvailable).toBe(10);
      expect(inv?.quantityReserved).toBe(5); // 3 from first order, 2 from second order

      // Cancel the second order
      await ordersService.cancelOrder(buyerUser.id, order!.id);

      // Stock should be returned
      inv = await prisma.inventory.findUnique({ where: { variantId: testVariant.id } });
      expect(inv?.quantityAvailable).toBe(12);
      expect(inv?.quantityReserved).toBe(3);

      const updatedOrder = await prisma.order.findUnique({ where: { id: order!.id } });
      expect(updatedOrder?.status).toBe(OrderStatus.cancelled);
    });
  });

  describe('Payment Capture & Escrow holds', () => {
    it('should capture payment, transition statuses, hold escrow, and log double-entry ledger records', async () => {
      // Find the first order (which is pending_payment, has 3 items reserved)
      const pendingOrder = await prisma.order.findFirst({
        where: { buyerId: buyerUser.id, status: OrderStatus.pending_payment },
      });

      // Capture payment simulating webhook
      await prisma.$transaction(async (tx) => {
        await paymentsService.capturePayment(tx, pendingOrder!.id, 'pay_token_123');
      });

      // 1. Verify order and payment statuses
      const order = await prisma.order.findUnique({
        where: { id: pendingOrder!.id },
        include: { payment: true, items: true },
      });
      expect(order?.status).toBe(OrderStatus.paid);
      expect(order?.payment?.status).toBe(PaymentStatus.captured);
      expect(order?.payment?.providerPaymentId).toBe('pay_token_123');

      // 2. Verify inventory reservation is deleted (permanently sold)
      const inv = await prisma.inventory.findUnique({ where: { variantId: testVariant.id } });
      expect(inv?.quantityAvailable).toBe(12);
      expect(inv?.quantityReserved).toBe(0);

      // 3. Verify EscrowHold record created
      const hold = await prisma.escrowHold.findFirst({
        where: { paymentId: order?.payment?.id },
      });
      expect(hold).toBeDefined();
      expect(hold?.status).toBe(EscrowStatus.held);
      expect(hold?.amount).toBe(1500000n); // 15000.00 lineTotal

      // 4. Verify double-entry Ledger entries
      const entries = await prisma.ledgerEntry.findMany({
        where: { paymentId: order?.payment?.id },
      });

      // Should have 4 entries: 2 matching capture (processor/buyer) and 2 matching escrow_hold (buyer/escrow)
      expect(entries).toHaveLength(4);

      const processorBal = await paymentsService.getLedgerAccountBalance(LedgerAccount.processor, 'UZS');
      const buyerBal = await paymentsService.getLedgerAccountBalance(LedgerAccount.buyer, 'UZS');
      const escrowBal = await paymentsService.getLedgerAccountBalance(LedgerAccount.escrow, 'UZS');

      // Grand total = 15200.00 UZS
      expect(processorBal).toBe(15200);  // debit
      expect(buyerBal).toBe(0);          // offset (credit 15200, debit 15200)
      expect(escrowBal).toBe(-15200);     // credit (credit matches negative balance in this simple sum)
    });
  });

  describe('Escrow Release on Delivery Confirmation', () => {
    it('should complete order, release escrow splits (seller payout & commission), and check zero-sum invariants', async () => {
      // Find the paid order
      const paidOrder = await prisma.order.findFirst({
        where: { buyerId: buyerUser.id, status: OrderStatus.paid },
      });

      // Simulating shipment by updating shipment status to shipped
      await ordersService.updateShipment(paidOrder!.id, {
        carrier: 'DHL Express',
        status: ShipmentStatus.shipped,
      });

      const shippedOrder = await prisma.order.findUnique({ where: { id: paidOrder!.id } });
      expect(shippedOrder?.status).toBe(OrderStatus.shipped);

      // Confirm delivery (buyer)
      await ordersService.confirmDelivery(buyerUser.id, paidOrder!.id);

      // 1. Verify Order status is completed
      const order = await prisma.order.findUnique({
        where: { id: paidOrder!.id },
        include: { shipment: true, items: true, payment: true },
      });
      expect(order?.status).toBe(OrderStatus.completed);
      expect(order?.shipment?.status).toBe(ShipmentStatus.delivered);
      expect(order?.items[0].fulfilmentStatus).toBe(FulfilmentStatus.delivered);

      // 2. Verify EscrowHold is released
      const hold = await prisma.escrowHold.findFirst({
        where: { paymentId: order?.payment?.id },
      });
      expect(hold?.status).toBe(EscrowStatus.released);
      expect(hold?.releasedAt).toBeDefined();

      // 3. Verify platform splits (amount = 15000.00, commission = 10% = 1500.00, payout = 13500.00)
      const payout = await prisma.payout.findFirst({
        where: { escrowHoldId: hold?.id },
      });
      expect(payout).toBeDefined();
      expect(Number(payout?.amount) / 100).toBe(13500);

      // 4. Verify Ledger Balances
      const escrowBal = await paymentsService.getLedgerAccountBalance(LedgerAccount.escrow, 'UZS');
      const sellerBal = await paymentsService.getLedgerAccountBalance(LedgerAccount.seller_payable, 'UZS');
      const revBal = await paymentsService.getLedgerAccountBalance(LedgerAccount.platform_revenue, 'UZS');
      const processorBal = await paymentsService.getLedgerAccountBalance(LedgerAccount.processor, 'UZS');

      // Escrow held grandTotal (15200) was partially released for the order item (15000).
      // Remaining escrow balance is 200 (for shipping fee).
      // Escrow account has been debited 15000 (13500 payout + 1500 commission).
      expect(escrowBal).toBe(-200); // original -15200 credit + 15000 debit = -200
      expect(sellerBal).toBe(-13500); // credit 13,500
      expect(revBal).toBe(-1500);    // credit 1,500

      // 5. Assert Ledger Invariants (All debits and credits across the whole payment must net to zero!)
      const allEntries = await prisma.ledgerEntry.findMany({
        where: { paymentId: order?.payment?.id },
      });

      let netSum = 0n;
      for (const entry of allEntries) {
        if (entry.direction === 'debit') {
          netSum += entry.amount;
        } else {
          netSum -= entry.amount;
        }
      }
      expect(netSum).toBe(0n); // MUST balance perfectly to 0!
    });
  });

  describe('Refund handling', () => {
    it('should request and complete a refund for an order item, verifying offset ledger balances', async () => {
      // 1. Place and pay a new order
      await cartService.addItem(buyerUser.id, undefined, {
        variantId: testVariant.id,
        quantity: 1,
      });

      const order = await ordersService.createOrder(buyerUser.id, {
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
        currency: 'UZS',
        provider: 'payme',
      });

      await prisma.$transaction(async (tx) => {
        await paymentsService.capturePayment(tx, order!.id, 'pay_token_refund');
      });

      // Get order item ID
      const orderItem = await prisma.orderItem.findFirst({
        where: { orderId: order!.id },
      });

      // 2. Perform refund
      const refund = await prisma.$transaction(async (tx) => {
        return paymentsService.refundOrderItem(tx, orderItem!.id, buyerUser.id, 'Faulty product');
      });
      expect(refund).toBeDefined();
      expect(refund.status).toBe('completed');
      expect(refund.reason).toBe('Faulty product');

      // 3. Verify EscrowHold status is refunded
      const hold = await prisma.escrowHold.findFirst({
        where: { orderItemId: orderItem!.id },
      });
      expect(hold?.status).toBe(EscrowStatus.refunded);

      // 4. Verify ledger entries for refund (escrow -> buyer, buyer -> processor)
      const refundEntries = await prisma.ledgerEntry.findMany({
        where: { paymentId: order?.payment?.id, entryType: 'refund' },
      });
      expect(refundEntries).toHaveLength(4); // 2 double-entries

      // Verify that all ledger entries for this payment net to zero
      const allEntries = await prisma.ledgerEntry.findMany({
        where: { paymentId: order?.payment?.id },
      });

      let netSum = 0n;
      for (const entry of allEntries) {
        if (entry.direction === 'debit') {
          netSum += entry.amount;
        } else {
          netSum -= entry.amount;
        }
      }
      expect(netSum).toBe(0n); // Balanced!
    });
  });
});
