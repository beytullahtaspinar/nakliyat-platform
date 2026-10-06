import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ayse@ornek.com', description: 'Hesaptaki e-posta adresi' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi gir' })
  @MaxLength(191)
  email: string;
}

export class ResetPasswordDto extends ForgotPasswordDto {
  @ApiProperty({ example: '513001', description: 'E-postaya gelen 6 haneli kod' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '') : value))
  @Matches(/^\d{6}$/, { message: 'Kod 6 haneli olmalı' })
  code: string;

  @ApiProperty({ example: 'YeniGucluSifre123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalı' })
  @MaxLength(72)
  password: string;
}
