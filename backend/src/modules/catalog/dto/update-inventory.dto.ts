import { IsNumber, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateInventoryDto {
  @IsNumber()
  @IsNotEmpty()
  quantityAvailable: number;

  @IsOptional()
  @IsNumber()
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  warehouseLocation?: string;
}
