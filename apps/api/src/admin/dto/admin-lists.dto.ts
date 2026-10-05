import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { RequestStatus, UserRole, UserStatus } from '../../generated/prisma/enums.js';
import { PaginationDto } from '../../requests/dto/list-requests.dto.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AdminListRequestsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ description: 'Müşteri adı veya telefonunda arar' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class AdminListUsersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Ad, telefon veya e-postada arar' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class AdminUpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  fullName?: string;

  @ApiPropertyOptional({ example: '0532 123 45 67' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Boş metin e-postayı siler', nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, v) => v !== '')
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class AdminSetPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalı' })
  @MaxLength(72)
  password: string;
}

/** Yönetimden açılan hesap (müşteri ya da firma yetkilisi) */
export class AdminCreateUserDto {
  @ApiProperty({ example: 'Ayşe Yılmaz' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  fullName: string;

  @ApiProperty({ example: '0532 123 45 67', description: 'Giriş bu numarayla yapılır' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'ayse@ornek.com', description: 'Teklif vermek/kabul etmek için doğrulanmış e-posta gerekir' })
  @Transform(trim)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalı' })
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({
    description: 'Telefon ve e-posta doğrulanmış sayılır (yönetici kişiyle görüşüp bilgileri teyit ettiyse)',
  })
  @IsOptional()
  @IsBoolean()
  markVerified?: boolean;
}

/** "0532 123" → "532123": telefonlar +90 ile saklandığı için baştaki 0 atılır; 3 haneden kısaysa aranmaz. */
export function phoneDigits(q: string | undefined): string | undefined {
  const digits = q?.replace(/\D/g, '').replace(/^0/, '');
  return digits && digits.length >= 3 ? digits : undefined;
}
