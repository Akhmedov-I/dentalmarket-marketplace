import { Controller, Get, Post, Patch, Delete, Body, Param, Headers, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { CartService } from '../services/cart.service';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';
import { MergeCartDto } from '../dto/merge-cart.dto';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { Request } from 'express';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private extractGuestCartId(headers: Record<string, any>): string | undefined {
    const guestCartId = headers['x-guest-cart-id'];
    if (guestCartId && typeof guestCartId === 'string') {
      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(guestCartId)) {
        throw new BadRequestException('x-guest-cart-id header must be a valid UUID');
      }
      return guestCartId;
    }
    return undefined;
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getCart(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers() headers: Record<string, any>,
  ) {
    const userId = user?.sub;
    const guestCartId = this.extractGuestCartId(headers);

    if (!userId && !guestCartId) {
      throw new BadRequestException('Must provide either authentication token or x-guest-cart-id header');
    }

    return this.cartService.getCart(userId, guestCartId);
  }

  @Post('items')
  @UseGuards(OptionalJwtAuthGuard)
  async addItem(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers() headers: Record<string, any>,
    @Body() dto: AddCartItemDto,
  ) {
    const userId = user?.sub;
    const guestCartId = this.extractGuestCartId(headers);

    if (!userId && !guestCartId) {
      throw new BadRequestException('Must provide either authentication token or x-guest-cart-id header');
    }

    return this.cartService.addItem(userId, guestCartId, dto);
  }

  @Patch('items/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async updateItem(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const userId = user?.sub;
    const guestCartId = this.extractGuestCartId(headers);

    if (!userId && !guestCartId) {
      throw new BadRequestException('Must provide either authentication token or x-guest-cart-id header');
    }

    return this.cartService.updateItem(userId, guestCartId, id, dto);
  }

  @Delete('items/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async removeItem(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
  ) {
    const userId = user?.sub;
    const guestCartId = this.extractGuestCartId(headers);

    if (!userId && !guestCartId) {
      throw new BadRequestException('Must provide either authentication token or x-guest-cart-id header');
    }

    return this.cartService.removeItem(userId, guestCartId, id);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  async mergeCart(
    @CurrentUser() user: JwtPayload,
    @Body() dto: MergeCartDto,
  ) {
    return this.cartService.mergeCart(user.sub, dto.guestCartId);
  }
}
