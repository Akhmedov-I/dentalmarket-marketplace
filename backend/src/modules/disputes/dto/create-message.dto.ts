import { IsString, Length } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @Length(1, 2000, { message: 'body must be between 1 and 2000 characters' })
  body: string;
}
