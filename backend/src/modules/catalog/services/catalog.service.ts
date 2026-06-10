import { Injectable, NotFoundException, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { CertificationService } from '../../certification/services/certification.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { UpdateInventoryDto } from '../dto/update-inventory.dto';
import { ProductStatus, CertHolderType, CertStatus } from '@prisma/client';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certService: CertificationService,
  ) {}

  /**
   * Retrieves the complete category tree (hierarchical)
   */
  async getCategories() {
    const categories = await this.prisma.category.findMany();
    
    const map = new Map<string, any>();
    categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
    
    const roots: any[] = [];
    categories.forEach((c) => {
      const node = map.get(c.id);
      if (c.parentId) {
        const parent = map.get(c.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });
    
    return roots;
  }

  /**
   * Creates a product draft with variants and inventory in a transaction
   */
  async createProduct(sellerId: string, dto: CreateProductDto) {
    // 1. Verify Category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // 2. Verify SKU unique for this seller
    const existingSku = await this.prisma.product.findFirst({
      where: { sellerId, sku: dto.sku },
    });
    if (existingSku) {
      throw new ConflictException('Product SKU already exists for your profile');
    }

    return this.prisma.$transaction(async (tx) => {
      // 3. Create main product record (defaulting to draft)
      const product = await tx.product.create({
        data: {
          sellerId,
          categoryId: dto.categoryId,
          sku: dto.sku,
          title: dto.title,
          titleI18n: { ru: dto.title }, // Fallback standard localization
          description: dto.description,
          descriptionI18n: { ru: dto.description },
          brand: dto.brand,
          model: dto.model,
          attributes: dto.attributes || {},
          basePrice: BigInt(dto.basePrice * 100), // scale to minor units (cents/tiyin)
          currency: dto.currency,
          status: ProductStatus.draft,
        },
      });

      // 4. Create variants and inventory slots
      if (dto.variants && dto.variants.length > 0) {
        for (const variantDto of dto.variants) {
          const variant = await tx.productVariant.create({
            data: {
              productId: product.id,
              name: variantDto.name,
              sku: variantDto.sku,
              priceOverride: variantDto.priceOverride ? BigInt(variantDto.priceOverride * 100) : null,
              currency: variantDto.currency || null,
              attributes: variantDto.attributes || {},
            },
          });

          await tx.inventory.create({
            data: {
              variantId: variant.id,
              quantityAvailable: 0,
              quantityReserved: 0,
              lowStockThreshold: 5,
            },
          });
        }
      }

      // 5. Associate certifications if provided
      if (dto.certificationIds && dto.certificationIds.length > 0) {
        await tx.certification.updateMany({
          where: {
            id: { in: dto.certificationIds },
            // Security: only allow linking certifications that belong to this seller
            sellerProfileId: sellerId,
          },
          data: {
            holderType: CertHolderType.product,
            productId: product.id,
            sellerProfileId: null,
          },
        });
      }

      return product;
    });
  }

  /**
   * Edit a product details
   */
  async updateProduct(sellerId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.sellerId !== sellerId) {
      throw new UnauthorizedException('You do not own this product');
    }

    const updateData: any = { ...dto };
    if (dto.basePrice !== undefined) {
      updateData.basePrice = BigInt(dto.basePrice * 100);
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: updateData,
    });
  }

  /**
   * Submit product listing for review.
   * Trigger category-required certifications validation.
   */
  async submitForReview(sellerId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.sellerId !== sellerId) {
      throw new UnauthorizedException('You do not own this product');
    }

    // Run the Core Business Rule: check for valid certifications
    const { isValid, missingStandards } = await this.certService.validateProductCertifications(
      productId,
      product.categoryId,
    );

    if (!isValid) {
      throw new BadRequestException(
        `Product lacks required verified certifications for this category. Missing standards: ${missingStandards.join(
          ', ',
        )}`,
      );
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.pending_review },
    });
  }

  /**
   * Admin Listing Moderation (Approve or Reject product)
   */
  async moderateProduct(adminId: string, productId: string, decision: 'approve' | 'reject') {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let newStatus: ProductStatus;
    if (decision === 'approve') {
      // Re-validate certs before approval to prevent race conditions
      const { isValid, missingStandards } = await this.certService.validateProductCertifications(
        productId,
        product.categoryId,
      );
      if (!isValid) {
        throw new BadRequestException(
          `Cannot approve product. Verified certifications missing: ${missingStandards.join(', ')}`,
        );
      }
      newStatus = ProductStatus.active;
    } else {
      newStatus = ProductStatus.rejected;
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          status: newStatus,
          publishedAt: newStatus === ProductStatus.active ? new Date() : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `product.moderate.${decision}`,
          entityType: 'Product',
          entityId: productId,
          before: { status: product.status },
          after: { status: newStatus },
        },
      });

      return updatedProduct;
    });
  }

  /**
   * Update Inventory stock levels
   */
  async updateInventory(sellerId: string, variantId: string, dto: UpdateInventoryDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }
    if (variant.product.sellerId !== sellerId) {
      throw new UnauthorizedException('You do not own the product for this variant');
    }

    return this.prisma.inventory.update({
      where: { variantId },
      data: {
        quantityAvailable: dto.quantityAvailable,
        lowStockThreshold: dto.lowStockThreshold ?? undefined,
        warehouseLocation: dto.warehouseLocation ?? undefined,
      },
    });
  }

  /**
   * Search and filter active products (Public API)
   */
  async browseProducts(filters: {
    categoryId?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }) {
    const whereClause: any = {
      status: ProductStatus.active,
    };

    if (filters.categoryId) {
      whereClause.categoryId = filters.categoryId;
    }
    if (filters.brand) {
      whereClause.brand = { contains: filters.brand, mode: 'insensitive' };
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      whereClause.basePrice = {};
      if (filters.minPrice !== undefined) {
        whereClause.basePrice.gte = BigInt(filters.minPrice * 100);
      }
      if (filters.maxPrice !== undefined) {
        whereClause.basePrice.lte = BigInt(filters.maxPrice * 100);
      }
    }
    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { model: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        images: true,
        certifications: {
          where: { status: CertStatus.verified },
          include: { standard: true },
        },
      },
    });

    // Map BigInt basePrice back to number for JSON response safety
    return products.map((product) => ({
      ...product,
      basePrice: Number(product.basePrice) / 100,
    }));
  }

  /**
   * Retrieve active product details with verified certifications (Public API)
   */
  async getProductDetails(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: {
          include: { inventory: true },
        },
        images: true,
        certifications: {
          where: { status: CertStatus.verified },
          include: { standard: true },
        },
        seller: {
          select: {
            legalName: true,
            ratingAvg: true,
            ratingCount: true,
          },
        },
      },
    });

    if (!product || product.status !== ProductStatus.active) {
      throw new NotFoundException('Product not found or not active');
    }

    return {
      ...product,
      basePrice: Number(product.basePrice) / 100,
      variants: product.variants.map((v) => ({
        ...v,
        priceOverride: v.priceOverride ? Number(v.priceOverride) / 100 : null,
      })),
    };
  }

  /**
   * Get queue of listings pending moderation (Admin queue)
   */
  async getPendingModerationList() {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.pending_review },
      include: {
        category: true,
        seller: true,
        certifications: {
          include: { standard: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
