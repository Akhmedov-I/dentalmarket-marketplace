import { IsUUID } from 'class-validator';

export class MergeCartDto {
  @IsUUID('4', { message: 'guestCartId must be a valid UUID v4' })
  guestCartId: string;
}
