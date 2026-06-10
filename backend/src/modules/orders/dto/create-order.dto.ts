import { IsUUID, IsString, IsIn, Length } from 'class-validator';

export class CreateOrderDto {
  @IsUUID('4', { message: 'shippingAddressId must be a valid UUID v4' })
  shippingAddressId: string;

  @IsUUID('4', { message: 'billingAddressId must be a valid UUID v4' })
  billingAddressId: string;

  @IsString()
  @Length(3, 3, { message: 'currency must be exactly 3 characters' })
  currency: string;

  @IsString()
  @IsIn(['payme', 'click', 'uzum', 'card', 'bank_transfer'], {
    message: 'provider must be click, payme, uzum, card, or bank_transfer',
  })
  provider: string;
}
