import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ALL_MIME_TYPES, MAX_VIDEO_SECONDS, STORAGE_KEY_PATTERN } from '../media-rules.js';

export class UploadFileDto {
  @ApiProperty({ enum: ALL_MIME_TYPES })
  @IsIn(ALL_MIME_TYPES, { message: 'Yalnızca fotoğraf (WebP/JPEG) ve MP4/WebM video yüklenebilir' })
  mimeType!: string;

  @ApiProperty({ description: 'Küçültülmüş dosyanın boyutu (bayt)' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CreateUploadsDto {
  @ApiProperty({ type: [UploadFileDto] })
  @ValidateNested({ each: true })
  @Type(() => UploadFileDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  files!: UploadFileDto[];
}

export class AttachMediaItemDto {
  @ApiProperty({ description: 'Yükleme adresiyle birlikte verilen anahtar' })
  @IsString()
  @Matches(STORAGE_KEY_PATTERN)
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  height?: number;

  @ApiPropertyOptional({ description: 'Video süresi (sn)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_VIDEO_SECONDS + 1)
  durationSec?: number;
}

export class AttachMediaDto {
  @ApiProperty({ type: [AttachMediaItemDto] })
  @ValidateNested({ each: true })
  @Type(() => AttachMediaItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  items!: AttachMediaItemDto[];
}
