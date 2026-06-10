import { IsUUID, IsString, IsEnum, IsOptional, Length } from 'class-validator';
import { DisputeType } from '@prisma/client';

export class CreateDisputeDto {
  @IsUUID('4', { message: 'orderId must be a valid UUID v4' })
  orderId: string;

  @IsUUID('4', { message: 'orderItemId must be a valid UUID v4' })
  @IsOptional()
  orderItemId?: string;

  @IsEnum(DisputeType, {
    message: 'type must be not_received, not_as_described, damaged, counterfeit_or_uncertified, or other',
  })
  type: DisputeType;

  @IsString()
  @Length(10, 1000, { message: 'description must be between 10 and 1000 characters' })
  description: string;
}
