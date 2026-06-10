import { IsArray, ValidateNested, IsString, IsBoolean, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class PreferenceItemDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsBoolean()
  enabled: boolean;
}

export class UpdatePreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDto)
  preferences: PreferenceItemDto[];
}
