import { IsUUID, IsInt, IsOptional, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID('4', { message: 'variantId must be a valid UUID v4' })
  variantId: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  @IsOptional()
  quantity?: number = 1;
}
