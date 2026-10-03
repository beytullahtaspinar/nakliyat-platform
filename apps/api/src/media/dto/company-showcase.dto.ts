import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SERVICE_CODES, SHOWCASE_RULES } from '../../companies/showcase-rules.js';
import { CompanyMediaKind } from '../../generated/prisma/enums.js';
import { STORAGE_KEY_PATTERN } from '../media-rules.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Boş gönderilen sayı alanı "silindi" demek: null. Formdan gelen metin sayıya çevrilir. */
const optionalInt = ({ value }: { value: unknown }) =>
  value === '' || value === null ? null : typeof value === 'string' ? Number(value) : value;

export class UpdateShowcaseDto {
  @ApiPropertyOptional({ description: 'Tanıtım yazısı. Telefon, e-posta ya da web adresi içeremez.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(SHOWCASE_RULES.descriptionMax)
  description?: string;

  @ApiPropertyOptional({ enum: SERVICE_CODES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SERVICE_CODES.length)
  @IsIn(SERVICE_CODES, { each: true })
  services?: string[];

  @ApiPropertyOptional({ example: 2008, nullable: true })
  @IsOptional()
  @Transform(optionalInt)
  @ValidateIf((_o, v) => v !== null)
  @IsInt({ message: 'Kuruluş yılı geçersiz' })
  @Min(1900, { message: 'Kuruluş yılı geçersiz' })
  @Max(2100, { message: 'Kuruluş yılı geçersiz' })
  foundedYear?: number | null;

  @ApiPropertyOptional({ description: 'Araç sayısı', nullable: true })
  @IsOptional()
  @Transform(optionalInt)
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(999)
  fleetSize?: number | null;

  @ApiPropertyOptional({ description: 'Ekip (çalışan) sayısı', nullable: true })
  @IsOptional()
  @Transform(optionalInt)
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(9999)
  staffSize?: number | null;
}

class UploadFileDto {
  @ApiProperty({ enum: SHOWCASE_RULES.mimeTypes })
  @IsIn(SHOWCASE_RULES.mimeTypes, { message: 'Görsel WebP ya da JPEG olmalı' })
  mimeType!: string;

  @ApiProperty({ description: 'Dosya boyutu (bayt)' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CreateShowcaseUploadDto {
  @ApiProperty({ enum: CompanyMediaKind })
  @IsEnum(CompanyMediaKind)
  kind!: CompanyMediaKind;

  @ApiProperty({ type: UploadFileDto, description: 'Logo ya da fotoğrafın büyük hali' })
  @ValidateNested()
  @Type(() => UploadFileDto)
  file!: UploadFileDto;

  @ApiPropertyOptional({ type: UploadFileDto, description: 'Fotoğrafın küçük önizlemesi (fotoğrafta zorunlu)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => UploadFileDto)
  thumb?: UploadFileDto;
}

export class AttachShowcaseMediaDto {
  @ApiProperty({ enum: CompanyMediaKind })
  @IsEnum(CompanyMediaKind)
  kind!: CompanyMediaKind;

  @ApiProperty()
  @IsString()
  @Matches(STORAGE_KEY_PATTERN)
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(STORAGE_KEY_PATTERN)
  thumbKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  height?: number;

  @ApiPropertyOptional({ description: 'Görsel açıklaması (alt metin)' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(SHOWCASE_RULES.captionMax)
  caption?: string;
}

export class UpdateShowcaseMediaDto {
  @ApiProperty({ description: 'Görsel açıklaması; boş bırakılırsa silinir' })
  @Transform(trim)
  @IsString()
  @MaxLength(SHOWCASE_RULES.captionMax)
  caption!: string;
}

export class HideShowcaseMediaDto {
  @ApiProperty({ description: 'Gizleme gerekçesi (firma panelinde görünür)' })
  @Transform(trim)
  @IsString()
  @Length(3, 300)
  reason!: string;
}
