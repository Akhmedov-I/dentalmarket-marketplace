import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from './reconciliation.service';
import { OrdersService } from '../../modules/orders/services/orders.service';
import { PaymentsService } from '../../modules/payments/services/payments.service';
import { CartService } from '../../modules/cart/services/cart.service';
import { PrismaService } from '@shared/db/prisma.service';
import { RedisService } from '@shared/redis/redis.service';
import { LedgerService } from './ledger.service';
import { ConfigModule } from '@nestjs/config';
import { UserStatus, KycStatus, SellerStatus, ProductStatus, AddressType, OrderStatus, EscrowStatus, LedgerEntryType, LedgerAccount, LedgerDirection } from '@prisma/client';

describe('Ledger Reconciliation Audit Tests', () => {
  let recService: ReconciliationService;
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
        ReconciliationService,
        OrdersService,
        PaymentsService,
        CartService,
        PrismaService,
        RedisService,
        LedgerService,
      ],
    }).compile();

    recService = module.get<ReconciliationService>(ReconciliationService);
    ordersService = module.get<OrdersService>(OrdersService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    cartService = module.get<CartService>(CartService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);

    redis.onModuleInit();

    await cleanup();

    // 1. Create buyer and seller users
    buyerUser = await prisma.user.create({
      data: {
        email: `buyer-rec-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    sellerUser = await prisma.user.create({
      data: {
        email: `seller-rec-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    // 2. Create seller profile
    sellerProfile = await prisma.sellerProfile.create({
      data: {
        userId: sellerUser.id,
        legalName: 'Reconciliation Corp',
        taxId: `TX-REC-${Date.now()}`,
        registrationNumber: `REG-REC-${Date.now()}`,
        sellerType: 'reseller',
        country: 'UZ',
        commissionRateBps: 500, // 5%
        kycStatus: KycStatus.approved,
        status: SellerStatus.active,
      },
    });

    // 3. Create addresses
    shippingAddress = await prisma.address.create({
      data: {
        userId: buyerUser.id,
        type: AddressType.shipping,
        recipient: 'Reconciliation Buyer',
        line1: '100 Reconciliation Blvd',
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
        recipient: 'Reconciliation Buyer',
        line1: '100 Reconciliation Blvd',
        city: 'Tashkent',
        region: 'Tashkent',
        postalCode: '100000',
        country: 'UZ',
      },
    });

    // 4. Create category, product, and variant
    testCategory = await prisma.category.create({
      data: {
        slug: `rec-cat-${Date.now()}`,
        name: 'Reconciliation Test Category',
        nameI18n: { ru: 'Тест Категория Реконсиляция' },
        path: '/rec-cat',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        sellerId: sellerProfile.id,
        categoryId: testCategory.id,
        sku: `REC-TEST-PROD-${Date.now()}`,
        title: 'Reconciliation Apparatus',
        description: 'Test reconciliation app',
        brand: 'DentRec',
        model: 'RC-1',
        basePrice: 100000n, // 1000.00
        currency: 'UZS',
        status: ProductStatus.active,
      },
    });

    testVariant = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        name: 'Model R',
        sku: `REC-VAR-${Date.now()}`,
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
        await prisma.user.deleteMany({ where: { id: { in: [buyerUser.id, sellerUser?.id].filter(Boolean) } } });
      }
    }
  }
  async function clearOrders() {
    if (prisma) {
      // Use TRUNCATE to bypass append-only triggers on ledger_entries
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE 
          dispute_messages, disputes, payouts, refunds,
          escrow_holds, ledger_entries, shipments, order_items,
          payments, orders, cart_items
        CASCADE
      `);
    }
  }

  describe('Ledger Audit and Reconciliation Checks', () => {
    let order: any;

    beforeEach(async () => {
      await clearOrders();
      
      // Place a valid order
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

      // Pay for it
      await prisma.$transaction(async (tx) => {
        await paymentsService.capturePayment(tx, order.id, 'pay_token_rec');
      });
    });

    it('should pass reconciliation check for balanced transactions', async () => {
      const report = await recService.runReconciliation();

      expect(report.success).toBe(true);
      expect(report.unbalancedPaymentIds).toHaveLength(0);
      expect(report.escrowMismatches).toHaveLength(0);
      expect(report.totalCheckedPayments).toBe(1);
    });

    it('should detect unbalanced payments where debits do not match credits', async () => {
      const payment = await prisma.payment.findUnique({
        where: { orderId: order.id },
      });

      // Inject corrupt/unbalanced ledger entry manually
      await prisma.ledgerEntry.create({
        data: {
          paymentId: payment!.id,
          entryType: LedgerEntryType.adjustment,
          account: LedgerAccount.processor,
          direction: LedgerDirection.debit,
          amount: 50000n, // 500 UZS debit without credit matching
          currency: 'UZS',
        },
      });

      const report = await recService.runReconciliation();

      expect(report.success).toBe(false);
      expect(report.unbalancedPaymentIds).toContain(payment!.id);
    });

    it('should detect escrow mismatches when holds do not align with ledger escrow account balance', async () => {
      const payment = await prisma.payment.findUnique({
        where: { orderId: order.id },
      });

      // Inject another ledger entry affecting the escrow account only, breaking the hold-ledger parity
      await prisma.ledgerEntry.create({
        data: {
          paymentId: payment!.id,
          entryType: LedgerEntryType.adjustment,
          account: LedgerAccount.escrow,
          direction: LedgerDirection.debit,
          amount: 20000n, // 200 UZS debit to escrow without updating holds
          currency: 'UZS',
        },
      });

      // Also record matching credit to processor to keep double-entry overall balance intact (netSum = 0)
      await prisma.ledgerEntry.create({
        data: {
          paymentId: payment!.id,
          entryType: LedgerEntryType.adjustment,
          account: LedgerAccount.processor,
          direction: LedgerDirection.credit,
          amount: 20000n,
          currency: 'UZS',
        },
      });

      const report = await recService.runReconciliation();

      // Overall sums are balanced (netSum = 0), but escrow holds vs ledger is mismatched
      expect(report.success).toBe(false);
      expect(report.unbalancedPaymentIds).not.toContain(payment!.id); // Balanced double-entry overall
      expect(report.escrowMismatches.map((m) => m.paymentId)).toContain(payment!.id);
    });
  });
});
