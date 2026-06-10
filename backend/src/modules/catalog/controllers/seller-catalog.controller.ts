import { Controller, Post, Patch, Body, Param, UseGuards, UnauthorizedException } from '@nestjs/common';
import { CatalogService } from '../services/catalog.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { UpdateInventoryDto } from '../dto/update-inventory.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '@shared/db/prisma.service';

@Controller('seller/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('seller')
export class SellerCatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async createDraft(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProductDto,
  ) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId: user.sub },
    });
    if (!seller) {
      throw new UnauthorizedException('Seller profile not found');
    }
    return this.catalogService.createProduct(seller.id, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId: user.sub },
    });
    if (!seller) {
      throw new UnauthorizedException('Seller profile not found');
    }
    return this.catalogService.updateProduct(seller.id, id, dto);
  }

  @Post(':id/submit')
  async submit(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId: user.sub },
    });
    if (!seller) {
      throw new UnauthorizedException('Seller profile not found');
    }
    return this.catalogService.submitForReview(seller.id, id);
  }

  @Patch('variants/:variantId/inventory')
  async updateInventory(
    @CurrentUser() user: JwtPayload,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId: user.sub },
    });
    if (!seller) {
      throw new UnauthorizedException('Seller profile not found');
    }
    return this.catalogService.updateInventory(seller.id, variantId, dto);
  }
}
