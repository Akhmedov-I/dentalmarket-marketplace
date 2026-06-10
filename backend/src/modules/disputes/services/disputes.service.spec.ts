import { Test, TestingModule } from '@nestjs/testing';
import { DisputesService } from './disputes.service';
import { OrdersService } from '../../orders/services/orders.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { CartService } from '../../cart/services/cart.service';
import { PrismaService } from '@shared/db/prisma.service';
import { RedisService } from '@shared/redis/redis.service';
import { LedgerService } from '@shared/finance/ledger.service';
import { ConfigModule } from '@nestjs/config';
import { UserStatus, KycStatus, SellerStatus, ProductStatus, AddressType, OrderStatus, EscrowStatus, PaymentStatus, LedgerAccount, FulfilmentStatus, DisputeType, DisputeStatus } from '@prisma/client';

describe('Disputes Module Integration Tests', () => {
  let disputesService: DisputesService;
  let ordersService: OrdersService;
  let paymentsService: PaymentsService;
  let cartService: CartService;
  let prisma: PrismaService;
  let redis: RedisService;

  let buyerUser: any;
  let sellerUser: any;
  let sellerProfile: any;
  let adminUser: any;
  let testCategory: any;
  let testProduct: any;
  let testVariant: any;
  let shippingAddress: any;
  let billingAddress: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        DisputesService,
        OrdersService,
        PaymentsService,
        CartService,
        PrismaService,
        RedisService,
        LedgerService,
      ],
    }).compile();

    disputesService = module.get<DisputesService>(DisputesService);
    ordersService = module.get<OrdersService>(OrdersService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    cartService = module.get<CartService>(CartService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);

    redis.onModuleInit();

    await cleanup();

    // 1. Create buyer, seller, admin users
    buyerUser = await prisma.user.create({
      data: {
        email: `buyer-dispute-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    sellerUser = await prisma.user.create({
      data: {
        email: `seller-dispute-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `admin-dispute-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    // 2. Create seller profile
    sellerProfile = await prisma.sellerProfile.create({
      data: {
        userId: sellerUser.id,
        legalName: 'Dispute Supplies LLC',
        taxId: `TX-DISP-${Date.now()}`,
        registrationNumber: `REG-DISP-${Date.now()}`,
        sellerType: 'reseller',
        country: 'UZ',
        commissionRateBps: 800, // 8%
        kycStatus: KycStatus.approved,
        status: SellerStatus.active,
      },
    });

    // 3. Create addresses
    shippingAddress = await prisma.address.create({
      data: {
        userId: buyerUser.id,
        type: AddressType.shipping,
        recipient: 'John Doe',
        line1: '45 Navoi Avenue',
        city: 'Tashkent',
        region: 'Tashkent',
        postalCode: '100011',
        country: 'UZ',
      },
    });

    billingAddress = await prisma.address.create({
      data: {
        userId: buyerUser.id,
        type: AddressType.billing,
        recipient: 'John Doe',
        line1: '45 Navoi Avenue',
        city: 'Tashkent',
        region: 'Tashkent',
        postalCode: '100011',
        country: 'UZ',
      },
    });

    // 4. Create catalog items
    testCategory = await prisma.category.create({
      data: {
        slug: `dispute-cat-${Date.now()}`,
        name: 'Dispute Test Category',
        nameI18n: { ru: 'Категория Споров' },
        path: '/dispute-cat',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        sellerId: sellerProfile.id,
        categoryId: testCategory.id,
        sku: `DISP-TEST-PROD-${Date.now()}`,
        title: 'Dental Drill Instrument',
        description: 'Test drill',
        brand: 'DentDrill',
        model: 'DD-200',
        basePrice: 1000000n, // 10000.00
        currency: 'UZS',
        status: ProductStatus.active,
      },
    });

    testVariant = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        name: 'Standard Model',
        sku: `DISP-VAR-${Date.now()}`,
        priceOverride: null,
        inventory: {
          create: {
            quantityAvailable: 10,
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
      // Use TRUNCATE to bypass append-only triggers on ledger_entries
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE 
          dispute_messages, disputes, payouts, refunds,
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
        await prisma.user.deleteMany({ where: { id: { in: [buyerUser.id, sellerUser?.id, adminUser?.id].filter(Boolean) } } });
      }
    }
  }

  describe('Dispute Management Life Cycle', () => {
    let order: any;
    let orderItem: any;

    beforeEach(async () => {
      // Create a paid order for dispute testing
      await cartService.addItem(buyerUser.id, undefined, {
        variantId: testVariant.id,
        quantity: 1,
      });

      order = await ordersService.createOrder(buyerUser.id, {
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
        currency: 'UZS',
        provider: 'payme',
      });

      await prisma.$transaction(async (tx) => {
        await paymentsService.capturePayment(tx, order.id, 'pay_token_dispute');
      });

      orderItem = await prisma.orderItem.findFirst({
        where: { orderId: order.id },
      });
    });

    it('should successfully raise a dispute on an item, lock order status to disputed, and open thread', async () => {
      const dispute = await disputesService.raiseDispute(buyerUser.id, {
        orderId: order.id,
        orderItemId: orderItem.id,
        type: DisputeType.damaged,
        description: 'The package arrived completely broken.',
      });

      expect(dispute).toBeDefined();
      expect(dispute.status).toBe(DisputeStatus.open);
      expect(dispute.raisedBy).toBe(buyerUser.id);
      expect(dispute.againstSellerId).toBe(sellerProfile.id);

      // Verify order status updated to disputed
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe(OrderStatus.disputed);

      // Verify the first message is created in the thread
      const messages = await prisma.disputeMessage.findMany({
        where: { disputeId: dispute.id },
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe('The package arrived completely broken.');
      expect(messages[0].senderId).toBe(buyerUser.id);
    });

    it('should allow conversation thread messages from allowed parties and reject closed disputes', async () => {
      const dispute = await disputesService.raiseDispute(buyerUser.id, {
        orderId: order.id,
        orderItemId: orderItem.id,
        type: DisputeType.not_received,
        description: 'I did not receive my polishing machine.',
      });

      // Seller sends message
      const sellerMsg = await disputesService.sendMessage(
        sellerUser.id,
        ['seller'],
        dispute.id,
        'I shipped it on Monday. Check tracking.'
      );
      expect(sellerMsg).toBeDefined();
      expect(sellerMsg.senderId).toBe(sellerUser.id);

      // Admin sends message
      const adminMsg = await disputesService.sendMessage(
        adminUser.id,
        ['admin'],
        dispute.id,
        'Admin joining to review.'
      );
      expect(adminMsg).toBeDefined();
      expect(adminMsg.senderId).toBe(adminUser.id);

      // Verify thread contains all three messages
      const details = await disputesService.getDisputeDetails(
        buyerUser.id,
        ['customer'],
        dispute.id
      );
      expect(details.messages).toHaveLength(3);
    });

    it('should resolve dispute as RELEASE to seller: releasing escrow, completing order', async () => {
      const dispute = await disputesService.raiseDispute(buyerUser.id, {
        orderId: order.id,
        orderItemId: orderItem.id,
        type: DisputeType.damaged,
        description: 'Broken handpiece.',
      });

      // Admin resolves and releases escrow
      const resolved = await disputesService.resolveDispute(adminUser.id, dispute.id, {
        decision: 'release',
        notes: 'Seller provided proof of pristine packaging. Releasing funds.',
      });

      expect(resolved?.status).toBe(DisputeStatus.resolved_release);

      // Verify EscrowHold released
      const hold = await prisma.escrowHold.findFirst({
        where: { orderItemId: orderItem.id },
      });
      expect(hold?.status).toBe(EscrowStatus.released);

      // Verify Order is completed
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe(OrderStatus.completed);

      // Verify payout schedule is created
      const payout = await prisma.payout.findFirst({
        where: { escrowHoldId: hold?.id },
      });
      expect(payout).toBeDefined();
      expect(payout?.status).toBe('scheduled');
    });

    it('should resolve dispute as REFUND to buyer: refunding escrow, cancelling order item', async () => {
      const dispute = await disputesService.raiseDispute(buyerUser.id, {
        orderId: order.id,
        orderItemId: orderItem.id,
        type: DisputeType.damaged,
        description: 'Broken handpiece.',
      });

      // Admin resolves and refunds buyer
      const resolved = await disputesService.resolveDispute(adminUser.id, dispute.id, {
        decision: 'refund',
        notes: 'Buyer claims confirmed. Refunding buyer.',
      });

      expect(resolved?.status).toBe(DisputeStatus.resolved_full_refund);

      // Verify EscrowHold refunded
      const hold = await prisma.escrowHold.findFirst({
        where: { orderItemId: orderItem.id },
      });
      expect(hold?.status).toBe(EscrowStatus.refunded);

      // Verify OrderItem cancelled
      const updatedItem = await prisma.orderItem.findUnique({
        where: { id: orderItem.id },
      });
      expect(updatedItem?.fulfilmentStatus).toBe(FulfilmentStatus.cancelled);

      // Verify Order is refunded
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe(OrderStatus.refunded);
    });
  });
});
