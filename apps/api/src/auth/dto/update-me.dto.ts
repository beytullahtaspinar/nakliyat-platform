import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class UpdateMeDto {
  @ApiProperty({ example: 'Ayşe Yılmaz' })
  @IsString()
  @Length(3, 100, { message: 'Ad soyad 3-100 karakter olmalı' })
  fullName: string;
}
