import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

const SELF_SIGNUP_ROLES = [UserRole.CUSTOMER, UserRole.COMPANY] as const;

export class RegisterDto {
  @ApiProperty({ enum: SELF_SIGNUP_ROLES, example: UserRole.CUSTOMER })
  @IsIn(SELF_SIGNUP_ROLES)
  role: (typeof SELF_SIGNUP_ROLES)[number];

  @ApiProperty({ example: 'Ayşe Yılmaz' })
  @IsString()
  @Length(3, 100)
  fullName: string;

  @ApiProperty({ example: '0532 123 45 67', description: 'Türkiye cep telefonu' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'ayse@ornek.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'GucluSifre123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({
    example: '2026-10-02',
    description: 'Kabul edilen kullanım koşulları / aydınlatma metni sürümü; kabul anıyla birlikte saklanır',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  termsVersion?: string;

  @ApiPropertyOptional({ description: 'Kampanya ve duyurular için ticari elektronik ileti izni (isteğe bağlı)' })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
