import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { VerificationStatus } from '../../generated/prisma/enums.js';
import { CreateCompanyProfileDto } from '../../companies/dto/company-profile.dto.js';
import { PaginationDto } from '../../requests/dto/list-requests.dto.js';
import { AdminCreateUserDto } from './admin-lists.dto.js';

export class ListCompaniesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @ApiPropertyOptional({ description: 'Firma adı, unvan, vergi no veya yetkili telefonunda arar' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class RejectCompanyDto {
  @ApiProperty({ example: 'K3 belgesinin süresi dolmuş, güncel belgeyi yükleyin.' })
  @IsString()
  @Length(5, 500)
  reason: string;
}

/**
 * Firma onayı. Zorunlu belge ya da onaylı araç eksikse yönetici gerekçe yazarak yine de onaylayabilir;
 * gerekçe ve o anki eksikler işlem geçmişine yazılır, firmaya gösterilmez.
 */
export class VerifyCompanyDto {
  @ApiPropertyOptional({ example: 'Belgeleri e-postayla gönderdi, sisteme yükleyecek.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(5, 500)
  overrideReason?: string;
}

/** Yönetimden firma açılışı: firma bilgileri + yetkilinin hesabı (fullName yetkilinin adıdır) */
export class AdminCreateCompanyDto extends IntersectionType(CreateCompanyProfileDto, AdminCreateUserDto) {}
