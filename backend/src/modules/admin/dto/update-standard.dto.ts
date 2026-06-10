import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { StandardCategory, ValidatorType } from '@prisma/client';

export class UpdateStandardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(StandardCategory)
  category?: StandardCategory;

  @IsOptional()
  @IsString()
  issuingRegion?: string;

  @IsOptional()
  @IsEnum(ValidatorType)
  validatorType?: ValidatorType;

  @IsOptional()
  @IsObject()
  validatorConfig?: Record<string, any>;
}
