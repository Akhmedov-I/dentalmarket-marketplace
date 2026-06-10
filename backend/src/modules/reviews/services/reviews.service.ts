import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { CreateReviewDto } from '../dto/create-review.dto';
import { ReviewStatus, FulfilmentStatus, OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit a product review.
   * Gated by purchase verification: order item must belong to the buyer and be delivered/completed.
   */
  async createReview(buyerId: string, dto: CreateReviewDto) {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: {
        order: true,
        variant: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }

    if (orderItem.order.buyerId !== buyerId) {
      throw new ForbiddenException('You do not own this order item');
    }

    // Verify delivery status
    const isDelivered =
      orderItem.fulfilmentStatus === FulfilmentStatus.delivered ||
      orderItem.order.status === OrderStatus.completed;

    if (!isDelivered) {
      throw new BadRequestException('You can only review items that have been delivered');
    }

    // Check if review already exists for this order item
    const existingReview = await this.prisma.review.findUnique({
      where: { orderItemId: dto.orderItemId },
    });

    if (existingReview) {
      throw new BadRequestException('You have already submitted a review for this item');
    }

    const productId = orderItem.variant.productId;
    const sellerId = orderItem.sellerId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Review (Publish immediately as per plan/MVP spec)
      const review = await tx.review.create({
        data: {
          orderItemId: dto.orderItemId,
          authorId: buyerId,
          productId,
          sellerId,
          rating: dto.rating,
          title: dto.title || null,
          body: dto.body || null,
          status: ReviewStatus.published,
          verifiedPurchase: true,
        },
      });

      // 2. Recalculate and update ratings for Product and Seller
      await this.updateRatings(tx, productId, sellerId);

      return review;
    });
  }

  /**
   * Get all published reviews for a product.
   */
  async getProductReviews(productId: string) {
    return this.prisma.review.findMany({
      where: {
        productId,
        status: ReviewStatus.published,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Helper to recalculate ratings for both a Product and a SellerProfile
   */
  private async updateRatings(tx: any, productId: string, sellerId: string) {
    // Product ratings update
    const productAggregate = await tx.review.aggregate({
      where: {
        productId,
        status: ReviewStatus.published,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const productRatingAvg = productAggregate._avg.rating || 0;
    const productRatingCount = productAggregate._count.rating || 0;

    await tx.product.update({
      where: { id: productId },
      data: {
        ratingAvg: new Decimal(productRatingAvg),
        ratingCount: productRatingCount,
      },
    });

    // Seller ratings update
    const sellerAggregate = await tx.review.aggregate({
      where: {
        sellerId,
        status: ReviewStatus.published,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const sellerRatingAvg = sellerAggregate._avg.rating || 0;
    const sellerRatingCount = sellerAggregate._count.rating || 0;

    await tx.sellerProfile.update({
      where: { id: sellerId },
      data: {
        ratingAvg: new Decimal(sellerRatingAvg),
        ratingCount: sellerRatingCount,
      },
    });
  }
}
