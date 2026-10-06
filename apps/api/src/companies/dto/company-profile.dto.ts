import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateCompanyProfileDto {
  @ApiProperty({ example: 'Örnek Nakliyat Taşımacılık Ltd. Şti.' })
  @IsString()
  @Length(3, 200)
  legalName: string;

  @ApiProperty({ example: 'Örnek Nakliyat', description: 'Müşterilere görünen ad' })
  @IsString()
  @Length(2, 80)
  displayName: string;

  @ApiProperty({ example: '1234567890', description: 'Vergi kimlik no (10 hane) veya şahıs şirketi için TCKN (11 hane)' })
  @Matches(/^\d{10,11}$/, { message: 'Vergi numarası 10 veya 11 haneli olmalı' })
  taxNumber: string;

  @ApiPropertyOptional({ example: 'K3.34.123456' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  k3LicenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @ApiProperty({ example: '34', description: 'Merkez ili plaka kodu' })
  @Matches(/^\d{2}$/)
  cityCode: string;

  @ApiProperty({ example: ['34', '41', '16'], description: 'Hizmet verilen iller (plaka kodu)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(81)
  @Matches(/^\d{2}$/, { each: true })
  serviceCityCodes: string[];
}

/**
 * Firmanın kendi düzenlemesi. Ticari unvan (vergi levhasındaki resmi ad) ve telefon burada yok: unvanı
 * yönetim PATCH /admin/companies/:id, telefonu PATCH /admin/users/:id ile değiştirir. Gövdede `legalName`,
 * `phone` ya da `contactPhone` gönderilirse ValidationPipe (forbidNonWhitelisted) isteği 400 ile reddeder.
 * Onaylı firmada `displayName` değişikliği hemen uygulanmaz, yönetim onayına düşer (name-change-rules.ts).
 */
export class UpdateCompanyProfileDto extends PartialType(OmitType(CreateCompanyProfileDto, ['legalName'] as const)) {}

/** Yönetimin düzeltmesi: tüm alanlar, unvan dahil. Ad değişikliği onaya düşmez, hemen uygulanır. */
export class AdminUpdateCompanyDto extends PartialType(CreateCompanyProfileDto) {}

export class RejectNameChangeDto {
  @ApiProperty({ example: 'Yeni ad vergi levhasındaki unvanla ilgisiz görünüyor.' })
  @IsString()
  @Length(5, 500)
  reason: string;
}
