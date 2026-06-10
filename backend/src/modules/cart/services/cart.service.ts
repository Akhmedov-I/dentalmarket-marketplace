import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { RedisService } from '@shared/redis/redis.service';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';
import { CartItem } from '@prisma/client';

@Injectable()
export class CartService {
  private readonly GUEST_CART_TTL = 14 * 24 * 60 * 60; // 14 days in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private getGuestCartKey(guestCartId: string): string {
    return `guest_cart:${guestCartId}`;
  }

  /**
   * Retrieves the cart contents for a user or guest.
   */
  async getCart(userId?: string, guestCartId?: string) {
    if (userId) {
      return this.getUserCart(userId);
    } else if (guestCartId) {
      return this.getGuestCart(guestCartId);
    } else {
      throw new BadRequestException('Either userId or guestCartId must be provided');
    }
  }

  /**
   * Adds an item to the cart.
   */
  async addItem(userId?: string, guestCartId?: string, dto?: AddCartItemDto) {
    if (!dto) {
      throw new BadRequestException('Item DTO is missing');
    }

    const { variantId, quantity = 1 } = dto;

    // 1. Fetch variant and check stock
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: true,
        inventory: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    const availableStock = variant.inventory?.quantityAvailable ?? 0;
    if (availableStock < quantity) {
      throw new BadRequestException(`Requested quantity exceeds available stock (${availableStock})`);
    }

    const price = variant.priceOverride !== null ? variant.priceOverride : variant.product.basePrice;
    const currency = variant.currency || variant.product.currency;

    if (userId) {
      // 2. Handle DB user cart
      let cart = await this.prisma.cart.findFirst({
        where: { userId },
      });

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { userId },
        });
      }

      const existingItem = await this.prisma.cartItem.findFirst({
        where: { cartId: cart.id, variantId },
      });

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (availableStock < newQuantity) {
          throw new BadRequestException(`Cannot add more. Total quantity in cart (${newQuantity}) exceeds available stock (${availableStock})`);
        }

        return this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
        });
      } else {
        return this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            variantId,
            quantity,
            unitPriceSnapshot: price,
            currency,
          },
        });
      }
    } else if (guestCartId) {
      // 3. Handle Redis guest cart
      const redisClient = this.redis.getClient();
      const key = this.getGuestCartKey(guestCartId);

      const existingQtyStr = await redisClient.hget(key, variantId);
      let newQuantity = quantity;

      if (existingQtyStr) {
        newQuantity = parseInt(existingQtyStr, 10) + quantity;
        if (availableStock < newQuantity) {
          throw new BadRequestException(`Cannot add more. Total quantity in cart (${newQuantity}) exceeds available stock (${availableStock})`);
        }
      }

      await redisClient.hset(key, variantId, newQuantity.toString());
      await redisClient.expire(key, this.GUEST_CART_TTL);

      return { variantId, quantity: newQuantity };
    } else {
      throw new BadRequestException('Either userId or guestCartId must be provided');
    }
  }

  /**
   * Updates the quantity of a cart item.
   */
  async updateItem(
    userId?: string,
    guestCartId?: string,
    variantIdOrCartItemId?: string,
    dto?: UpdateCartItemDto,
  ) {
    if (!variantIdOrCartItemId) {
      throw new BadRequestException('Item identifier is missing');
    }
    if (!dto) {
      throw new BadRequestException('Update DTO is missing');
    }

    const { quantity } = dto;

    if (userId) {
      // For authenticated user, variantIdOrCartItemId is cartItem.id
      const item = await this.prisma.cartItem.findUnique({
        where: { id: variantIdOrCartItemId },
        include: {
          cart: true,
          variant: {
            include: { inventory: true },
          },
        },
      });

      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      if (item.cart.userId !== userId) {
        throw new BadRequestException('Access denied. Cart item ownership mismatch');
      }

      const availableStock = item.variant.inventory?.quantityAvailable ?? 0;
      if (availableStock < quantity) {
        throw new BadRequestException(`Requested quantity exceeds available stock (${availableStock})`);
      }

      return this.prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    } else if (guestCartId) {
      // For guests, variantIdOrCartItemId is the variantId
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantIdOrCartItemId },
        include: { inventory: true },
      });

      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }

      const availableStock = variant.inventory?.quantityAvailable ?? 0;
      if (availableStock < quantity) {
        throw new BadRequestException(`Requested quantity exceeds available stock (${availableStock})`);
      }

      const redisClient = this.redis.getClient();
      const key = this.getGuestCartKey(guestCartId);

      const exists = await redisClient.hexists(key, variantIdOrCartItemId);
      if (!exists) {
        throw new NotFoundException('Item not found in guest cart');
      }

      await redisClient.hset(key, variantIdOrCartItemId, quantity.toString());
      await redisClient.expire(key, this.GUEST_CART_TTL);

      return { variantId: variantIdOrCartItemId, quantity };
    } else {
      throw new BadRequestException('Either userId or guestCartId must be provided');
    }
  }

  /**
   * Removes an item from the cart.
   */
  async removeItem(userId?: string, guestCartId?: string, variantIdOrCartItemId?: string) {
    if (!variantIdOrCartItemId) {
      throw new BadRequestException('Item identifier is missing');
    }

    if (userId) {
      const item = await this.prisma.cartItem.findUnique({
        where: { id: variantIdOrCartItemId },
        include: { cart: true },
      });

      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      if (item.cart.userId !== userId) {
        throw new BadRequestException('Access denied. Cart item ownership mismatch');
      }

      await this.prisma.cartItem.delete({
        where: { id: variantIdOrCartItemId },
      });

      return { success: true };
    } else if (guestCartId) {
      const redisClient = this.redis.getClient();
      const key = this.getGuestCartKey(guestCartId);

      const removed = await redisClient.hdel(key, variantIdOrCartItemId);
      if (!removed) {
        throw new NotFoundException('Item not found in guest cart');
      }

      return { success: true };
    } else {
      throw new BadRequestException('Either userId or guestCartId must be provided');
    }
  }

  /**
   * Merges Redis guest cart into the authenticated user's database cart.
   */
  async mergeCart(userId: string, guestCartId: string) {
    const redisClient = this.redis.getClient();
    const key = this.getGuestCartKey(guestCartId);

    const guestItems = await redisClient.hgetall(key);
    if (!guestItems || Object.keys(guestItems).length === 0) {
      return this.getUserCart(userId);
    }

    // 1. Find or create user cart
    let cart = await this.prisma.cart.findFirst({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    // 2. Perform merge in transaction
    await this.prisma.$transaction(async (tx) => {
      for (const [variantId, qtyStr] of Object.entries(guestItems)) {
        const guestQty = parseInt(qtyStr, 10);

        // Fetch variant current details
        const variant = await tx.productVariant.findUnique({
          where: { id: variantId },
          include: {
            product: true,
            inventory: true,
          },
        });

        if (!variant) continue; // Skip invalid variants

        const currentPrice = variant.priceOverride !== null ? variant.priceOverride : variant.product.basePrice;
        const currency = variant.currency || variant.product.currency;
        const availableStock = variant.inventory?.quantityAvailable ?? 0;

        const existingItem = await tx.cartItem.findFirst({
          where: { cartId: cart.id, variantId },
        });

        if (existingItem) {
          // Merge quantities, cap at stock
          const mergedQty = Math.min(existingItem.quantity + guestQty, availableStock);
          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: mergedQty,
              // Update snapshot price to current price
              unitPriceSnapshot: currentPrice,
              currency,
            },
          });
        } else {
          // Add new item, cap quantity at stock
          const finalQty = Math.min(guestQty, availableStock);
          if (finalQty > 0) {
            await tx.cartItem.create({
              data: {
                cartId: cart.id,
                variantId,
                quantity: finalQty,
                unitPriceSnapshot: currentPrice,
                currency,
              },
            });
          }
        }
      }
    });

    // 3. Clear guest cart from Redis
    await redisClient.del(key);

    return this.getUserCart(userId);
  }

  // --- Helpers ---

  private async getUserCart(userId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return {
        id: null,
        items: [] as any[],
        subtotal: 0,
        currency: 'UZS', // default fallback
        priceWarnings: [] as string[],
      };
    }

    const items: any[] = [];
    let subtotal = 0;
    let currency = 'UZS';
    const priceWarnings: string[] = [];

    for (const item of cart.items) {
      const variant = item.variant;
      const product = variant.product;

      const currentPrice = variant.priceOverride !== null ? variant.priceOverride : product.basePrice;
      const itemCurrency = variant.currency || product.currency;
      currency = itemCurrency; // assume unified currency for cart checkout

      const currentPriceNum = Number(currentPrice) / 100;
      const snapshotPriceNum = Number(item.unitPriceSnapshot) / 100;

      const priceChanged = currentPrice !== item.unitPriceSnapshot;
      if (priceChanged) {
        priceWarnings.push(`Price for ${product.title} (${variant.name}) changed from ${snapshotPriceNum} to ${currentPriceNum} ${currency}`);
      }

      subtotal += currentPriceNum * item.quantity;

      items.push({
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceSnapshot: snapshotPriceNum,
        currentPrice: currentPriceNum,
        priceChanged,
        currency,
        title: product.title,
        sku: variant.sku,
        name: variant.name,
        attributes: variant.attributes,
      });
    }

    return {
      id: cart.id,
      items,
      subtotal,
      currency,
      priceWarnings,
    };
  }

  private async getGuestCart(guestCartId: string) {
    const redisClient = this.redis.getClient();
    const key = this.getGuestCartKey(guestCartId);

    const guestItems = await redisClient.hgetall(key);
    if (!guestItems || Object.keys(guestItems).length === 0) {
      return {
        id: guestCartId,
        items: [],
        subtotal: 0,
        currency: 'UZS',
        priceWarnings: [],
      };
    }

    const items: any[] = [];
    let subtotal = 0;
    let currency = 'UZS';

    for (const [variantId, qtyStr] of Object.entries(guestItems)) {
      const quantity = parseInt(qtyStr, 10);

      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true },
      });

      if (!variant) {
        // Variant no longer exists, clean it up from Redis
        await redisClient.hdel(key, variantId);
        continue;
      }

      const currentPrice = variant.priceOverride !== null ? variant.priceOverride : variant.product.basePrice;
      currency = variant.currency || variant.product.currency;

      const currentPriceNum = Number(currentPrice) / 100;
      subtotal += currentPriceNum * quantity;

      items.push({
        id: variantId, // For guests, cartItem.id is variantId
        variantId,
        quantity,
        unitPriceSnapshot: currentPriceNum, // for guest, snapshot equals current
        currentPrice: currentPriceNum,
        priceChanged: false,
        currency,
        title: variant.product.title,
        sku: variant.sku,
        name: variant.name,
        attributes: variant.attributes,
      });
    }

    return {
      id: guestCartId,
      items,
      subtotal,
      currency,
      priceWarnings: [],
    };
  }
}
