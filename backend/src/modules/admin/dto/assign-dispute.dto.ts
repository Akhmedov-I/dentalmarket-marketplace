import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AssignDisputeDto {
  @IsUUID('4', { message: 'adminId must be a valid UUID' })
  @IsNotEmpty()
  adminId: string;
}
