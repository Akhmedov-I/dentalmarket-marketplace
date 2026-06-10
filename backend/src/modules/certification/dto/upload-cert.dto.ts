import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { CertHolderType } from '@prisma/client';

export class UploadCertDto {
  @IsEnum(CertHolderType)
  @IsNotEmpty()
  holderType: CertHolderType;

  @IsUUID()
  @IsNotEmpty()
  holderId: string;

  @IsUUID()
  @IsNotEmpty()
  standardId: string;

  @IsString()
  @IsNotEmpty()
  certificateNumber: string;

  @IsString()
  @IsNotEmpty()
  issuedBy: string;

  @IsString()
  @IsNotEmpty()
  issueDate: string; // ISO date string or YYYY-MM-DD

  @IsOptional()
  @IsString()
  expiryDate?: string;
}
