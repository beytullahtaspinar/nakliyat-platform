import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

export class OAuthStartDto {
  @ApiProperty({ description: 'Web tarafının ürettiği rastgele değer; dönüşte karşılaştırılır (CSRF)' })
  @IsString()
  @Length(16, 128)
  state: string;

  @ApiProperty({ description: 'id_token içinde geri gelir (tekrar oynatmaya karşı)' })
  @IsString()
  @Length(16, 128)
  nonce: string;

  @ApiProperty({ description: 'PKCE S256: base64url(sha256(codeVerifier))' })
  @IsString()
  @Length(43, 128)
  codeChallenge: string;

  @ApiPropertyOptional({ description: 'Önerilen hesap (e-posta)' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  loginHint?: string;
}

export class OAuthCallbackDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4096)
  code: string;

  @ApiProperty()
  @IsString()
  @Length(43, 128)
  codeVerifier: string;

  @ApiProperty()
  @IsString()
  @Length(16, 128)
  nonce: string;

  @ApiPropertyOptional({ description: 'Apple ilk girişte gönderdiği "user" form alanı (ad)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  appleUser?: string;
}

export class SignupTokenDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4096)
  signupToken: string;
}

const SELF_SIGNUP_ROLES = [UserRole.CUSTOMER, UserRole.COMPANY] as const;

export class OAuthCompleteDto extends SignupTokenDto {
  @ApiProperty({ enum: SELF_SIGNUP_ROLES })
  @IsIn(SELF_SIGNUP_ROLES)
  role: (typeof SELF_SIGNUP_ROLES)[number];

  @ApiProperty({ example: 'Ayşe Yılmaz' })
  @IsString()
  @Length(3, 100)
  fullName: string;

  @ApiProperty({ example: '0532 123 45 67' })
  @IsString()
  phone: string;
}
