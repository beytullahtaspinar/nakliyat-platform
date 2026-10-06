import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PaginationDto } from '../../requests/dto/list-requests.dto.js';
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH, REPLY_MAX_LENGTH } from '../review-rules.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Boş metin "yorum yok" demektir */
const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @Type(() => Number)
  @IsInt({ message: 'Puan 1 ile 5 arasında olmalı' })
  @Min(1, { message: 'Puan 1 ile 5 arasında olmalı' })
  @Max(5, { message: 'Puan 1 ile 5 arasında olmalı' })
  rating!: number;

  @ApiPropertyOptional({
    example: 'Eşyalarımız tek çizik almadan taşındı, ekip çok özenliydi.',
    minLength: COMMENT_MIN_LENGTH,
    maxLength: COMMENT_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @Length(COMMENT_MIN_LENGTH, COMMENT_MAX_LENGTH, {
    message: `Yorum ${COMMENT_MIN_LENGTH}-${COMMENT_MAX_LENGTH} karakter olmalı`,
  })
  comment?: string;
}

export class ReplyReviewDto {
  @ApiProperty({ example: 'Güzel yorumunuz için teşekkür ederiz, yeni evinizde mutluluklar.', maxLength: REPLY_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @Length(2, REPLY_MAX_LENGTH, { message: `Yanıt 2-${REPLY_MAX_LENGTH} karakter olmalı` })
  body!: string;
}

export class HideReviewDto {
  @ApiProperty({ example: 'Yorumda telefon numarası ve hakaret var.' })
  @Transform(trim)
  @IsString()
  @Length(5, 500, { message: 'Gerekçe 5-500 karakter olmalı' })
  reason!: string;
}

export class CancelBookingDto {
  @ApiProperty({ example: 'Taşınma tarihim değişti, ev sahibi çıkışı bir ay erteledi.' })
  @Transform(trim)
  @IsString()
  @Length(5, 500, { message: 'İptal nedeni 5-500 karakter olmalı' })
  reason!: string;
}

export const REVIEW_SORTS = ['newest', 'oldest', 'lowest', 'highest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

/** Firma panelinde ve yönetimde ortak süzgeç ve sıralama */
export class ListReviewsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['visible', 'hidden'], description: 'Boşsa hepsi' })
  @IsOptional()
  @IsIn(['visible', 'hidden'])
  status?: 'visible' | 'hidden';

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Yalnızca bu puandaki yorumlar' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ enum: ['answered', 'unanswered'], description: 'Firma yanıtı olan / olmayan' })
  @IsOptional()
  @IsIn(['answered', 'unanswered'])
  reply?: 'answered' | 'unanswered';

  @ApiPropertyOptional({ enum: REVIEW_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn(REVIEW_SORTS)
  sort: ReviewSort = 'newest';

  @ApiPropertyOptional({ description: 'Yorum metninde (yönetimde firma adında da) arar' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class AdminListReviewsDto extends ListReviewsDto {}

/** Herkese açık firma listesi (site haritası için büyük sayfa) */
export class PublicCompaniesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 100, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit = 100;

  @ApiPropertyOptional({ description: 'true: yalnızca en az bir yorumu olan firmalar' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['true', 'false'])
  reviewed?: 'true' | 'false';

  @ApiPropertyOptional({
    description: 'true: yalnızca arama motoruna açık sayfalar (yorumu olan ya da tanıtımı yeterince dolu firmalar)',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['true', 'false'])
  indexable?: 'true' | 'false';

  @ApiPropertyOptional({ example: '34', description: 'Bu ilde hizmet veren firmalar (merkez ya da hizmet ili)' })
  @IsOptional()
  @Matches(/^\d{2}$/)
  city?: string;

  @ApiPropertyOptional({ example: '06', description: 'city ile birlikte: iki ile de hizmet veren firmalar (şehirler arası)' })
  @IsOptional()
  @Matches(/^\d{2}$/)
  toCity?: string;
}
