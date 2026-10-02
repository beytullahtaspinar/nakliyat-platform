import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { CompanyDocumentType } from '../../generated/prisma/enums.js';
import { DOCUMENT_RULES } from '../company-document-rules.js';
import { STORAGE_KEY_PATTERN } from '../media-rules.js';

export class CreateDocumentUploadDto {
  @ApiProperty({ enum: DOCUMENT_RULES.mimeTypes })
  @IsIn(DOCUMENT_RULES.mimeTypes, { message: 'Belge PDF, JPG, PNG ya da WebP olmalı' })
  mimeType!: string;

  @ApiProperty({ description: 'Dosya boyutu (bayt)' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class AttachDocumentDto {
  @ApiProperty({ enum: CompanyDocumentType })
  @IsEnum(CompanyDocumentType, { message: 'Belge türünü seçin' })
  type!: CompanyDocumentType;

  @ApiProperty({ description: 'Yükleme adresiyle birlikte verilen anahtar' })
  @IsString()
  @Matches(STORAGE_KEY_PATTERN)
  key!: string;

  @ApiProperty({ example: 'k3-yetki-belgesi.pdf' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().slice(0, 200) : value))
  @IsString()
  @Length(1, 200)
  fileName!: string;

  @ApiPropertyOptional({ example: '2029-05-31', description: 'Geçerlilik bitişi (K3 için zorunlu)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Geçerlilik tarihi YYYY-AA-GG biçiminde olmalı' })
  validUntil?: string;
}
