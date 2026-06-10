import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VerificationResult } from '@prisma/client';

export class VerifyCertDto {
  @IsEnum(VerificationResult)
  @IsNotEmpty()
  result: VerificationResult; // pass, fail, inconclusive

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
