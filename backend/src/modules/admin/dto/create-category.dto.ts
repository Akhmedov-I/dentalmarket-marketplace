import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsNotEmpty()
  nameI18n: Record<string, string>; // { "ru": "...", "uz": "...", "en": "..." }

  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @IsString()
  @IsNotEmpty()
  path: string; // materialised path for subtree queries

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  requiredStandardIds?: string[];
}
