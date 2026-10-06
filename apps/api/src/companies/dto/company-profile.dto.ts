import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
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
 * Firma kendi telefonunu değiştiremez: numara sahibin hesabında (User.phone) tutulur ve burada alanı yok.
 * Gövdede `phone`/`contactPhone` gönderilirse ValidationPipe (forbidNonWhitelisted) isteği 400 ile reddeder.
 * Numarayı yalnızca yönetim PATCH /admin/users/:id ile günceller.
 */
export class UpdateCompanyProfileDto extends PartialType(CreateCompanyProfileDto) {}
