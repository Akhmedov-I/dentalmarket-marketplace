import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the user's wishlist with product details.
   */
  async getWishlist(userId: string) {
    let wishlist = await this.prisma.wishlist.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { position: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    orderBy: { position: 'asc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });
    }

    return wishlist.items.map((item) => {
      const product = item.product;
      const basePriceNum = Number(product.basePrice) / 100;

      return {
        id: item.id,
        productId: product.id,
        title: product.title,
        brand: product.brand,
        model: product.model,
        basePrice: basePriceNum,
        currency: product.currency,
        status: product.status,
        image: product.images[0]?.objectKey || null,
        createdAt: item.createdAt,
      };
    });
  }

  /**
   * Adds a product to the user's wishlist.
   */
  async addItem(userId: string, productId: string) {
    // 1. Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // 2. Find or create wishlist
    let wishlist = await this.prisma.wishlist.findFirst({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: { userId },
      });
    }

    // 3. Check for duplicates
    const existingItem = await this.prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId,
        },
      },
    });

    if (existingItem) {
      return existingItem;
    }

    // 4. Add item to wishlist
    return this.prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId,
      },
    });
  }

  /**
   * Removes a product from the user's wishlist.
   */
  async removeItem(userId: string, productId: string) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { userId },
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    const item = await this.prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Product not found in your wishlist');
    }

    await this.prisma.wishlistItem.delete({
      where: { id: item.id },
    });

    return { success: true };
  }
}
