import { IsUUID, IsInt, Min, Max, IsString, IsOptional, Length } from 'class-validator';

export class CreateReviewDto {
  @IsUUID('4', { message: 'orderItemId must be a valid UUID v4' })
  orderItemId: string;

  @IsInt({ message: 'rating must be an integer' })
  @Min(1, { message: 'rating must be at least 1' })
  @Max(5, { message: 'rating must be at most 5' })
  rating: number;

  @IsString()
  @IsOptional()
  @Length(3, 100, { message: 'title must be between 3 and 100 characters' })
  title?: string;

  @IsString()
  @IsOptional()
  @Length(5, 2000, { message: 'body must be between 5 and 2000 characters' })
  body?: string;
}
