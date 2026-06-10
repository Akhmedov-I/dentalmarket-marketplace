import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { WishlistService } from '../services/wishlist.service';
import { AddWishlistItemDto } from '../dto/add-wishlist-item.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async getWishlist(@CurrentUser() user: JwtPayload) {
    return this.wishlistService.getWishlist(user.sub);
  }

  @Post('items')
  async addItem(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddWishlistItemDto,
  ) {
    return this.wishlistService.addItem(user.sub, dto.productId);
  }

  @Delete('items/:productId')
  async removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.removeItem(user.sub, productId);
  }
}
