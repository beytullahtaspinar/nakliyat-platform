import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { IsCleanText } from '../../common/utils/content-filter.js';

export const MESSAGE_MAX_LENGTH = 2000;

export class SendMessageDto {
  @ApiProperty({ example: 'Merhaba, taşınma günü saat 09:00 uygun mu?', maxLength: MESSAGE_MAX_LENGTH })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, MESSAGE_MAX_LENGTH, { message: `Mesaj 1-${MESSAGE_MAX_LENGTH} karakter olmalı` })
  @IsCleanText()
  body!: string;
}
