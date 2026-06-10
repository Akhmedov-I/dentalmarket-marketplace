import { IsUUID } from 'class-validator';

export class AddWishlistItemDto {
  @IsUUID('4', { message: 'productId must be a valid UUID v4' })
  productId: string;
}
