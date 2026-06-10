import { IsIn, IsNotEmpty, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

export class KycDecisionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'], { message: 'decision must be approved or rejected' })
  decision: 'approved' | 'rejected';

  @ValidateIf((o) => o.decision === 'rejected')
  @IsString()
  @IsNotEmpty({ message: 'reason is required when rejecting KYC' })
  @Length(5, 1000, { message: 'reason must be between 5 and 1000 characters' })
  reason?: string;
}
