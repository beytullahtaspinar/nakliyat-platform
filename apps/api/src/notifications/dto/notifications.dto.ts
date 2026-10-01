import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { NOTIFICATION_TYPES, OPTIONAL_CHANNELS, type NotificationType, type OptionalChannel } from '../notification-types.js';

const TYPES = Object.keys(NOTIFICATION_TYPES) as NotificationType[];

export class PreferenceItemDto {
  @ApiProperty({ enum: TYPES })
  @IsIn(TYPES)
  type: NotificationType;

  @ApiProperty({ enum: OPTIONAL_CHANNELS })
  @IsIn(OPTIONAL_CHANNELS)
  channel: OptionalChannel;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    nullable: true,
    example: 'ayse@ornek.com',
    description: 'Bildirim e-postalarının gideceği adres. null gönderilirse silinir.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ValidateIf((_, value) => value !== null)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi gir' })
  @MaxLength(191)
  email?: string | null;

  @ApiPropertyOptional({ type: [PreferenceItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDto)
  items?: PreferenceItemDto[];
}
