import { IsString, IsIn, Length } from 'class-validator';

export class ResolveDisputeDto {
  @IsString()
  @IsIn(['release', 'refund'], { message: 'decision must be release or refund' })
  decision: 'release' | 'refund';

  @IsString()
  @Length(5, 1000, { message: 'notes must be between 5 and 1000 characters' })
  notes: string;
}
