import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ShipmentStatus } from '@prisma/client';

export class UpdateShipmentDto {
  @IsString()
  carrier: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsEnum(ShipmentStatus, {
    message: 'status must be preparing, shipped, in_transit, delivered, or failed',
  })
  status: ShipmentStatus;

  @IsDateString({}, { message: 'estimatedDelivery must be a valid ISO date string' })
  @IsOptional()
  estimatedDelivery?: string;
}
