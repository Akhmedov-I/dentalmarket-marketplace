import { IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class AdminResolveDisputeDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['release', 'partial_refund', 'full_refund'], {
    message: 'decision must be release, partial_refund, or full_refund',
  })
  decision: 'release' | 'partial_refund' | 'full_refund';

  @IsString()
  @IsNotEmpty()
  @Length(5, 2000, { message: 'notes must be between 5 and 2000 characters' })
  notes: string;

  @IsOptional()
  @IsString()
  refundAmountMinor?: string; // BigInt as string for partial refunds
}
