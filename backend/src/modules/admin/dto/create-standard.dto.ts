import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { StandardCategory, ValidatorType } from '@prisma/client';

export class CreateStandardDto {
  @IsString()
  @IsNotEmpty()
  code: string; // e.g. CE_MDR, FDA_510K

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(StandardCategory)
  @IsNotEmpty()
  category: StandardCategory;

  @IsString()
  @IsNotEmpty()
  issuingRegion: string;

  @IsEnum(ValidatorType)
  @IsNotEmpty()
  validatorType: ValidatorType;

  @IsOptional()
  @IsObject()
  validatorConfig?: Record<string, any>;
}
