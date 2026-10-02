import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../generated/prisma/enums.js';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty() fullName: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional({ type: String, nullable: true }) email: string | null;
  @ApiProperty() phoneVerified: boolean;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty({ description: 'Talep yayını, teklif verme ve teklif kabulü için gereken doğrulamalar tamam' })
  verified: boolean;
}

export class AuthTokensDto {
  @ApiProperty({ description: 'Kısa ömürlü erişim anahtarı (15 dk)' })
  accessToken: string;

  @ApiProperty({ description: 'Uzun ömürlü yenileme anahtarı (30 gün), tek kullanımlık' })
  refreshToken: string;
}

export class AuthResponseDto extends AuthTokensDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
