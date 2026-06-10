import { IsArray, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  nameI18n?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  requiredStandardIds?: string[];
}
