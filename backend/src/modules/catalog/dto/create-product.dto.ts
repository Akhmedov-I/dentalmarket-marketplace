import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID, IsJSON, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsOptional()
  @IsNumber()
  priceOverride?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsNumber()
  @IsNotEmpty()
  basePrice: number; // passed as number, stored as BigInt minor units

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  certificationIds?: string[];
}
