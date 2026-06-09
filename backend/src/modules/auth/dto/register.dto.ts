import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsEnum } from 'class-validator';

export enum RegisterRole {
  CUSTOMER = 'customer',
  SELLER = 'seller',
}

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(RegisterRole)
  @IsNotEmpty()
  role: RegisterRole;

  // Seller fields (required conditionally if role is seller)
  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  sellerType?: 'manufacturer' | 'authorised_distributor' | 'reseller';
}
