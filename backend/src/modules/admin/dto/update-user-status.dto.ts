import { IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, { message: 'status must be one of: active, suspended, pending, banned' })
  @IsNotEmpty()
  status: UserStatus;

  @IsString()
  @IsNotEmpty()
  @Length(5, 1000, { message: 'reason must be between 5 and 1000 characters' })
  reason: string;
}
