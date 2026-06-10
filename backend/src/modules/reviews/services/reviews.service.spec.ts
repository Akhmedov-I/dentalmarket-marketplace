import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { OrdersService } from '../../orders/services/orders.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { CartService } from '../../cart/services/cart.service';
import { PrismaService } from '@shared/db/prisma.service';
import { RedisService } from '@shared/redis/redis.service';
import { LedgerService } from '@shared/finance/ledger.service';
import { ConfigModule } from '@nestjs/config';
import { UserStatus, KycStatus, SellerStatus, ProductStatus, AddressType, OrderStatus, EscrowStatus, FulfilmentStatus, ShipmentStatus } from '@prisma/client';

describe('Reviews Module Integration Tests', () => {
  let reviewsService: ReviewsService;
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
        ReviewsService,
        OrdersService,
        PaymentsService,
        CartService,
        PrismaService,
        RedisService,
        LedgerService,
      ],
    }).compile();

    reviewsService = module.get<ReviewsService>(ReviewsService);
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
        email: `buyer-review-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    sellerUser = await prisma.user.create({
      data: {
        email: `seller-review-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    // 2. Create seller profile
    sellerProfile = await prisma.sellerProfile.create({
      data: {
        userId: sellerUser.id,
        legalName: 'Polishing Products Corp',
        taxId: `TX-REV-${Date.now()}`,
        registrationNumber: `REG-REV-${Date.now()}`,
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
        recipient: 'Alice Smith',
        line1: '100 Broadway',
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
        recipient: 'Alice Smith',
        line1: '100 Broadway',
        city: 'Tashkent',
        region: 'Tashkent',
        postalCode: '100000',
        country: 'UZ',
      },
    });

    // 4. Create category, product, and variant
    testCategory = await prisma.category.create({
      data: {
        slug: `review-cat-${Date.now()}`,
        name: 'Review Test Category',
        nameI18n: { ru: 'Тест Категория Отзывы' },
        path: '/review-cat',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        sellerId: sellerProfile.id,
        categoryId: testCategory.id,
        sku: `REV-TEST-PROD-${Date.now()}`,
        title: 'Dental Curing Light',
        description: 'Test curing light',
        brand: 'DentLight',
        model: 'CL-100',
        basePrice: 200000n, // 2000.00
        currency: 'UZS',
        status: ProductStatus.active,
      },
    });

    testVariant = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        name: 'Model X',
        sku: `REV-VAR-${Date.now()}`,
        priceOverride: null,
        inventory: {
          create: {
            quantityAvailable: 20,
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

  describe('Verified Product Reviews', () => {
    let order: any;
    let orderItem: any;

    beforeEach(async () => {
      // 1. Place order
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

      // 2. Pay for the order
      await prisma.$transaction(async (tx) => {
        await paymentsService.capturePayment(tx, order.id, 'pay_token_review');
      });

      orderItem = await prisma.orderItem.findFirst({
        where: { orderId: order.id },
      });
    });

    it('should reject review submission if the item is not delivered yet', async () => {
      await expect(
        reviewsService.createReview(buyerUser.id, {
          orderItemId: orderItem.id,
          rating: 5,
          title: 'Excellent!',
          body: 'Great value for money.',
        })
      ).rejects.toThrow('You can only review items that have been delivered');
    });

    it('should successfully submit a review when delivered and verify verifiedPurchase flag is true', async () => {
      // Transition order/item to delivered
      await ordersService.updateShipment(order.id, {
        carrier: 'Fargo Express',
        status: ShipmentStatus.shipped,
      });

      await ordersService.confirmDelivery(buyerUser.id, order.id);

      const review = await reviewsService.createReview(buyerUser.id, {
        orderItemId: orderItem.id,
        rating: 5,
        title: 'Perfect!',
        body: 'Exceeded my expectations.',
      });

      expect(review).toBeDefined();
      expect(review.rating).toBe(5);
      expect(review.title).toBe('Perfect!');
      expect(review.verifiedPurchase).toBe(true);

      // Verify double submission throws error
      await expect(
        reviewsService.createReview(buyerUser.id, {
          orderItemId: orderItem.id,
          rating: 4,
          title: 'Again',
          body: 'Submitting twice.',
        })
      ).rejects.toThrow('You have already submitted a review for this item');
    });

    it('should update average rating and review counts on product and seller profile upon submission', async () => {
      // 1. Place a second order
      await cartService.addItem(buyerUser.id, undefined, {
        variantId: testVariant.id,
        quantity: 1,
      });

      const secondOrder = await ordersService.createOrder(buyerUser.id, {
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
        currency: 'UZS',
        provider: 'payme',
      });

      await prisma.$transaction(async (tx) => {
        await paymentsService.capturePayment(tx, secondOrder!.id, 'pay_token_review_2');
      });

      const secondItem = await prisma.orderItem.findFirst({
        where: { orderId: secondOrder!.id },
      });

      // Deliver second order
      await ordersService.updateShipment(secondOrder!.id, {
        carrier: 'Fargo Express',
        status: ShipmentStatus.shipped,
      });
      await ordersService.confirmDelivery(buyerUser.id, secondOrder!.id);

      // Submit review with rating = 3
      await reviewsService.createReview(buyerUser.id, {
        orderItemId: secondItem!.id,
        rating: 3,
        title: 'Average',
        body: 'It is okay.',
      });

      // Product ratings should average: (5 + 3) / 2 = 4.0
      const updatedProduct = await prisma.product.findUnique({
        where: { id: testProduct.id },
      });
      expect(Number(updatedProduct?.ratingAvg)).toBe(4);
      expect(updatedProduct?.ratingCount).toBe(2);

      // Seller ratings should average: (5 + 3) / 2 = 4.0
      const updatedSeller = await prisma.sellerProfile.findUnique({
        where: { id: sellerProfile.id },
      });
      expect(Number(updatedSeller?.ratingAvg)).toBe(4);
      expect(updatedSeller?.ratingCount).toBe(2);
    });
  });
});
