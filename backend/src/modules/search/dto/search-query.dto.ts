import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum SearchSort {
  relevance = 'relevance',
  price_asc = 'price_asc',
  price_desc = 'price_desc',
  rating = 'rating',
  newest = 'newest',
}

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  certification_standard?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_max?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  seller_rating_min?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  in_stock?: boolean;

  @IsOptional()
  @IsEnum(SearchSort)
  sort?: SearchSort = SearchSort.relevance;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 24;
}
