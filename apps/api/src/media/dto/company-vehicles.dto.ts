import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Matches, Min, ValidateNested } from 'class-validator';
import { VehicleAuthorization, VehicleFileKind, VehicleType } from '../../generated/prisma/enums.js';
import { STORAGE_KEY_PATTERN } from '../media-rules.js';
import { normalizePlate, PLATE_PATTERN, VEHICLE_RULES } from '../vehicle-rules.js';

const MIME_TYPES = [...new Set([...VEHICLE_RULES.registration.mimeTypes, ...VEHICLE_RULES.photo.mimeTypes])];

export class CreateVehicleUploadDto {
  @ApiProperty({ enum: VehicleFileKind })
  @IsEnum(VehicleFileKind, { message: 'Dosya türünü seçin' })
  kind!: VehicleFileKind;

  @ApiProperty({ enum: MIME_TYPES })
  @IsIn(MIME_TYPES, { message: 'Dosya PDF, JPG, PNG ya da WebP olmalı' })
  mimeType!: string;

  @ApiProperty({ description: 'Dosya boyutu (bayt)' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class VehicleFileInputDto {
  @ApiProperty({ description: 'Yükleme adresiyle birlikte verilen anahtar' })
  @IsString()
  @Matches(STORAGE_KEY_PATTERN)
  key!: string;

  @ApiProperty({ example: 'ruhsat.jpg' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().slice(0, 200) : value))
  @IsString()
  @Length(1, 200)
  fileName!: string;
}

/** Ruhsat ve üç fotoğraf; araç eklerken dördü de zorunlu, düzeltirken yalnızca değişenler */
export class VehicleFilesDto {
  @ApiPropertyOptional({ type: VehicleFileInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleFileInputDto)
  REGISTRATION?: VehicleFileInputDto;

  @ApiPropertyOptional({ type: VehicleFileInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleFileInputDto)
  FRONT?: VehicleFileInputDto;

  @ApiPropertyOptional({ type: VehicleFileInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleFileInputDto)
  SIDE?: VehicleFileInputDto;

  @ApiPropertyOptional({ type: VehicleFileInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleFileInputDto)
  REAR?: VehicleFileInputDto;
}

const plateValue = () => Transform(({ value }) => (typeof value === 'string' ? normalizePlate(value) : value));
const PLATE_MESSAGE = 'Plakayı ruhsattaki gibi yazın (ör. 34 ABC 123)';
const AUTHORIZATION_MESSAGE = 'Aracın kayıtlı olduğu yetki belgesini (K3 ya da L1) seçin';

export class CreateVehicleDto {
  @ApiProperty({ example: '34 ABC 123', description: 'Boşluklu ya da boşluksuz yazılabilir' })
  @plateValue()
  @IsString({ message: 'Plakayı yazın' })
  @Matches(PLATE_PATTERN, { message: PLATE_MESSAGE })
  plate!: string;

  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType, { message: 'Araç tipini seçin' })
  type!: VehicleType;

  @ApiProperty({ enum: VehicleAuthorization, description: 'Aracın kayıtlı olduğu yetki belgesi' })
  @IsEnum(VehicleAuthorization, { message: AUTHORIZATION_MESSAGE })
  authorization!: VehicleAuthorization;

  @ApiProperty({ type: VehicleFilesDto, description: 'Ruhsat ve önden, yandan, arkadan fotoğraf' })
  @ValidateNested()
  @Type(() => VehicleFilesDto)
  files!: VehicleFilesDto;
}

/** Onaylanmamış aracın düzeltilmesi: yalnızca değişen alanlar ve dosyalar */
export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: '34 ABC 123' })
  @IsOptional()
  @plateValue()
  @IsString()
  @Matches(PLATE_PATTERN, { message: PLATE_MESSAGE })
  plate?: string;

  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType, { message: 'Araç tipini seçin' })
  type?: VehicleType;

  @ApiPropertyOptional({ enum: VehicleAuthorization })
  @IsOptional()
  @IsEnum(VehicleAuthorization, { message: AUTHORIZATION_MESSAGE })
  authorization?: VehicleAuthorization;

  @ApiPropertyOptional({ type: VehicleFilesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleFilesDto)
  files?: VehicleFilesDto;
}
