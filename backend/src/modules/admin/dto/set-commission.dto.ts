import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class SetCommissionDto {
  @IsInt()
  @IsNotEmpty()
  @Min(0, { message: 'commissionRateBps must be at least 0' })
  @Max(5000, { message: 'commissionRateBps must not exceed 5000 (50%)' })
  commissionRateBps: number;
}
