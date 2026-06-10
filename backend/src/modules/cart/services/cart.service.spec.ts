import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { WishlistService } from '../../wishlist/services/wishlist.service';
import { PrismaService } from '@shared/db/prisma.service';
import { RedisService } from '@shared/redis/redis.service';
import { ConfigModule } from '@nestjs/config';
import { UserStatus, KycStatus, SellerStatus, ProductStatus, CartItem } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

describe('Cart & Wishlist Service Integration Tests', () => {
  let cartService: CartService;
  let wishlistService: WishlistService;
  let prisma: PrismaService;
  let redis: RedisService;

  let testUser: any;
  let testSeller: any;
  let testCategory: any;
  let testProduct: any;
  let testVariant1: any;
  let testVariant2: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        CartService,
        WishlistService,
        PrismaService,
        RedisService,
      ],
    }).compile();

    cartService = module.get<CartService>(CartService);
    wishlistService = module.get<WishlistService>(WishlistService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);

    // Initialise Redis connection if not done
    redis.onModuleInit();

    // Clean up database testing records if any leak occurred
    await cleanup();

    // 1. Create a test user
    testUser = await prisma.user.create({
      data: {
        email: `test-buyer-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    // 2. Create a test seller profile
    testSeller = await prisma.sellerProfile.create({
      data: {
        userId: testUser.id,
        legalName: 'Test Buyer LLC',
        taxId: '123456780',
        registrationNumber: 'REG-998',
        sellerType: 'reseller',
        country: 'UZ',
        kycStatus: KycStatus.approved,
        status: SellerStatus.active,
      },
    });

    // 3. Create a test category
    testCategory = await prisma.category.create({
      data: {
        slug: `test-cat-cart-${Date.now()}`,
        name: 'Test Cart Category',
        nameI18n: { ru: 'Тест Категория Корзина' },
        path: '/test-cat-cart',
      },
    });

    // 4. Create a test product
    testProduct = await prisma.product.create({
      data: {
        sellerId: testSeller.id,
        categoryId: testCategory.id,
        sku: `CART-TEST-PROD-${Date.now()}`,
        title: 'Test Dental Chair',
        description: 'Test chair description',
        brand: 'ChairCorp',
        model: 'CC-100',
        basePrice: 100000n, // 1000.00
        currency: 'UZS',
        status: ProductStatus.active,
      },
    });

    // 5. Create two variants with inventory stock
    testVariant1 = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        name: 'Variant Standard',
        sku: `CART-VAR-1-${Date.now()}`,
        priceOverride: null, // fallback to basePrice (1000.00)
        inventory: {
          create: {
            quantityAvailable: 10,
            quantityReserved: 0,
            lowStockThreshold: 2,
          },
        },
      },
    });

    testVariant2 = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        name: 'Variant Premium',
        sku: `CART-VAR-2-${Date.now()}`,
        priceOverride: 150000n, // 1500.00
        inventory: {
          create: {
            quantityAvailable: 5,
            quantityReserved: 0,
            lowStockThreshold: 1,
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
    // Clean up Redis keys used in testing
    if (redis) {
      const redisClient = redis.getClient();
      const keys = await redisClient.keys('guest_cart:*');
      for (const k of keys) {
        await redisClient.del(k);
      }
    }

    // Delete DB entries in reverse order
    if (prisma) {
      if (testUser) {
        // Find cart
        const cart = await prisma.cart.findFirst({ where: { userId: testUser.id } });
        if (cart) {
          await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
          await prisma.cart.delete({ where: { id: cart.id } });
        }

        const wishlist = await prisma.wishlist.findFirst({ where: { userId: testUser.id } });
        if (wishlist) {
          await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
          await prisma.wishlist.delete({ where: { id: wishlist.id } });
        }
      }

      if (testProduct) {
        await prisma.inventory.deleteMany({
          where: { variantId: { in: [testVariant1?.id, testVariant2?.id].filter(Boolean) } },
        });
        await prisma.productVariant.deleteMany({ where: { productId: testProduct.id } });
        await prisma.product.delete({ where: { id: testProduct.id } });
      }

      if (testCategory) {
        await prisma.category.delete({ where: { id: testCategory.id } });
      }

      if (testSeller) {
        await prisma.sellerProfile.delete({ where: { id: testSeller.id } });
      }

      if (testUser) {
        await prisma.user.delete({ where: { id: testUser.id } });
      }
    }
  }

  describe('Guest Cart (Redis)', () => {
    const guestCartId = uuidv4();

    it('should add items to the guest cart in Redis', async () => {
      await cartService.addItem(undefined, guestCartId, {
        variantId: testVariant1.id,
        quantity: 2,
      });

      const cart = await cartService.getCart(undefined, guestCartId);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].variantId).toBe(testVariant1.id);
      expect(cart.items[0].quantity).toBe(2);
      expect(cart.items[0].currentPrice).toBe(1000); // 1000.00
      expect(cart.subtotal).toBe(2000);
    });

    it('should block adding quantities exceeding stock for guest cart', async () => {
      await expect(
        cartService.addItem(undefined, guestCartId, {
          variantId: testVariant1.id,
          quantity: 20, // stock is 10, 2 + 20 = 22 > 10
        }),
      ).rejects.toThrow('Requested quantity exceeds available stock');
    });

    it('should update item quantities in the guest cart', async () => {
      await cartService.updateItem(undefined, guestCartId, testVariant1.id, {
        quantity: 5,
      });

      const cart = await cartService.getCart(undefined, guestCartId);
      expect(cart.items[0].quantity).toBe(5);
      expect(cart.subtotal).toBe(5000);
    });

    it('should remove items from the guest cart', async () => {
      await cartService.removeItem(undefined, guestCartId, testVariant1.id);
      const cart = await cartService.getCart(undefined, guestCartId);
      expect(cart.items).toHaveLength(0);
    });
  });

  describe('Authenticated Cart (PostgreSQL)', () => {
    it('should add items to user cart with snapshot price', async () => {
      const cartItem = (await cartService.addItem(testUser.id, undefined, {
        variantId: testVariant2.id,
        quantity: 1,
      })) as CartItem;

      expect(cartItem).toBeDefined();
      expect(Number(cartItem.unitPriceSnapshot) / 100).toBe(1500); // 1500.00 (variant 2 override price)

      const cart = await cartService.getCart(testUser.id);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].variantId).toBe(testVariant2.id);
      expect(cart.items[0].quantity).toBe(1);
      expect(cart.subtotal).toBe(1500);
    });

    it('should update quantities in authenticated cart', async () => {
      const cart = await cartService.getCart(testUser.id);
      const cartItemId = cart.items[0].id;

      await cartService.updateItem(testUser.id, undefined, cartItemId, {
        quantity: 3,
      });

      const updatedCart = await cartService.getCart(testUser.id);
      expect(updatedCart.items[0].quantity).toBe(3);
      expect(updatedCart.subtotal).toBe(4500);
    });

    it('should block updating quantity beyond stock limit', async () => {
      const cart = await cartService.getCart(testUser.id);
      const cartItemId = cart.items[0].id;

      await expect(
        cartService.updateItem(testUser.id, undefined, cartItemId, {
          quantity: 10, // stock is 5
        }),
      ).rejects.toThrow('Requested quantity exceeds available stock');
    });

    it('should remove items from user cart', async () => {
      const cart = await cartService.getCart(testUser.id);
      const cartItemId = cart.items[0].id;

      await cartService.removeItem(testUser.id, undefined, cartItemId);
      const updatedCart = await cartService.getCart(testUser.id);
      expect(updatedCart.items).toHaveLength(0);
    });
  });

  describe('Cart Merging', () => {
    it('should merge guest Redis cart into authenticated user cart', async () => {
      const guestCartId = uuidv4();

      // 1. Prepare items in guest cart (Variant 1: qty 3, Variant 2: qty 2)
      await cartService.addItem(undefined, guestCartId, {
        variantId: testVariant1.id,
        quantity: 3,
      });
      await cartService.addItem(undefined, guestCartId, {
        variantId: testVariant2.id,
        quantity: 2,
      });

      // 2. Prepare items in user cart (Variant 2: qty 1)
      await cartService.addItem(testUser.id, undefined, {
        variantId: testVariant2.id,
        quantity: 1,
      });

      // 3. Perform merge
      const mergedCart = await cartService.mergeCart(testUser.id, guestCartId);

      // 4. Verify results
      // Variant 1: guest 3, user 0 => 3 (stock 10)
      // Variant 2: guest 2, user 1 => 3 (stock 5)
      expect(mergedCart.items).toHaveLength(2);

      const item1 = mergedCart.items.find((i) => i.variantId === testVariant1.id);
      const item2 = mergedCart.items.find((i) => i.variantId === testVariant2.id);

      expect(item1?.quantity).toBe(3);
      expect(item2?.quantity).toBe(3);

      // Verify that Redis key was cleaned up
      const redisClient = redis.getClient();
      const guestCartKey = `guest_cart:${guestCartId}`;
      const exists = await redisClient.exists(guestCartKey);
      expect(exists).toBe(0);
    });
  });

  describe('Wishlist', () => {
    it('should add product to wishlist', async () => {
      const item = await wishlistService.addItem(testUser.id, testProduct.id);
      expect(item).toBeDefined();
      expect(item.productId).toBe(testProduct.id);

      const wishlist = await wishlistService.getWishlist(testUser.id);
      expect(wishlist).toHaveLength(1);
      expect(wishlist[0].productId).toBe(testProduct.id);
      expect(wishlist[0].title).toBe('Test Dental Chair');
    });

    it('should ignore duplicate additions to wishlist', async () => {
      await wishlistService.addItem(testUser.id, testProduct.id);
      const wishlist = await wishlistService.getWishlist(testUser.id);
      expect(wishlist).toHaveLength(1);
    });

    it('should remove product from wishlist', async () => {
      await wishlistService.removeItem(testUser.id, testProduct.id);
      const wishlist = await wishlistService.getWishlist(testUser.id);
      expect(wishlist).toHaveLength(0);
    });
  });
});
