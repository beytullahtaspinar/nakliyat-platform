import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BlogPostStatus } from '../../generated/prisma/enums.js';
import { PaginationDto } from '../../requests/dto/list-requests.dto.js';
import { BLOG_MEDIA_KEY_PATTERN, BLOG_RULES, SLUG_PATTERN } from '../blog-rules.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Boş metin "silindi" demek: null */
const emptyToNull = ({ value }: { value: unknown }) => {
  const v = typeof value === 'string' ? value.trim() : value;
  return v === '' ? null : v;
};
const SLUG_MESSAGE = 'Adres yalnızca küçük harf, rakam ve tire içerebilir (ör. tasinma-kontrol-listesi)';

// ─── Herkese açık ──────────────────────────────────────────────

export class ListBlogPostsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Kategori kısa adı' })
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  category?: string;

  @ApiPropertyOptional({ description: 'Yazar kısa adı' })
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  author?: string;
}

// ─── Yönetim: yazılar ──────────────────────────────────────────

export const ADMIN_POST_FILTERS = ['published', 'scheduled', 'draft'] as const;

export class AdminListBlogPostsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ADMIN_POST_FILTERS })
  @IsOptional()
  @IsIn(ADMIN_POST_FILTERS)
  status?: (typeof ADMIN_POST_FILTERS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Başlık veya adreste arar' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class BlogFaqItemDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, BLOG_RULES.faqQuestionMax, { message: `Soru 5-${BLOG_RULES.faqQuestionMax} karakter olmalı` })
  question!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, BLOG_RULES.faqAnswerMax, { message: `Cevap 5-${BLOG_RULES.faqAnswerMax} karakter olmalı` })
  answer!: string;
}

export class SaveBlogPostDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, BLOG_RULES.titleMax, { message: `Başlık 5-${BLOG_RULES.titleMax} karakter olmalı` })
  title!: string;

  @ApiPropertyOptional({ description: 'Boşsa başlıktan üretilir' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.slugMax)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string | null;

  @ApiProperty({ description: 'Liste kartındaki özet' })
  @Transform(trim)
  @IsString()
  @MaxLength(BLOG_RULES.excerptMax, { message: `Özet en fazla ${BLOG_RULES.excerptMax} karakter olabilir` })
  excerpt!: string;

  @ApiPropertyOptional({ description: '"Kısaca" kutusu: sorunun net cevabı', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.summaryMax)
  summary?: string | null;

  @ApiProperty({ description: 'İçerik (Markdown)' })
  @IsString()
  @MaxLength(BLOG_RULES.contentMax)
  content!: string;

  @ApiPropertyOptional({ type: [BlogFaqItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BLOG_RULES.faqMax, { message: `En fazla ${BLOG_RULES.faqMax} soru eklenebilir` })
  @ValidateNested({ each: true })
  @Type(() => BlogFaqItemDto)
  faq?: BlogFaqItemDto[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.seoTitleMax, { message: `SEO başlığı en fazla ${BLOG_RULES.seoTitleMax} karakter olabilir` })
  seoTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.seoDescriptionMax, {
    message: `SEO açıklaması en fazla ${BLOG_RULES.seoDescriptionMax} karakter olabilir`,
  })
  seoDescription?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noindex?: boolean;

  @ApiProperty({ enum: BlogPostStatus })
  @IsEnum(BlogPostStatus)
  status!: BlogPostStatus;

  @ApiPropertyOptional({ description: 'Yayın zamanı; gelecekteyse zamanlanır. Boşsa yayınlarken şimdi.', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsDateString({}, { message: 'Yayın tarihi geçersiz' })
  publishedAt?: string | null;

  @ApiPropertyOptional({ description: 'Yayındaki yazıda önemli değişiklik: okura "güncellendi" tarihi gösterilir' })
  @IsOptional()
  @IsBoolean()
  markUpdated?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(BLOG_MEDIA_KEY_PATTERN)
  coverKey?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.coverAltMax)
  coverAlt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  authorId?: string | null;
}

// ─── Yönetim: kategoriler ve yazarlar ──────────────────────────

export class SaveBlogCategoryDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, BLOG_RULES.categoryNameMax, { message: `Kategori adı 2-${BLOG_RULES.categoryNameMax} karakter olmalı` })
  name!: string;

  @ApiPropertyOptional({ description: 'Boşsa addan üretilir' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.slugMax)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.categoryDescriptionMax)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Menüdeki sıra (küçük önce)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class SaveBlogAuthorDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, BLOG_RULES.authorNameMax, { message: `Ad 2-${BLOG_RULES.authorNameMax} karakter olmalı` })
  name!: string;

  @ApiPropertyOptional({ description: 'Boşsa addan üretilir' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.slugMax)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.authorJobTitleMax)
  jobTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.authorBioMax)
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(BLOG_MEDIA_KEY_PATTERN)
  photoKey?: string | null;

  @ApiPropertyOptional({ description: 'Profil adresleri (LinkedIn vb.)', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BLOG_RULES.sameAsMax)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true, message: 'Profil adresleri https:// ile başlamalı' })
  sameAs?: string[];
}

// ─── Yönetim: görseller ────────────────────────────────────────

class BlogUploadFileDto {
  @ApiProperty({ enum: BLOG_RULES.mimeTypes })
  @IsIn(BLOG_RULES.mimeTypes, { message: 'Görsel WebP ya da JPEG olmalı' })
  mimeType!: string;

  @ApiProperty({ description: 'Dosya boyutu (bayt)' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CreateBlogUploadDto {
  @ApiProperty({ type: BlogUploadFileDto, description: 'Büyük görsel (en uzun kenar 1600 px)' })
  @ValidateNested()
  @Type(() => BlogUploadFileDto)
  file!: BlogUploadFileDto;

  @ApiProperty({ type: BlogUploadFileDto, description: 'Önizleme (800 px)' })
  @ValidateNested()
  @Type(() => BlogUploadFileDto)
  thumb!: BlogUploadFileDto;
}

class Dimensions {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(10000)
  width!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(10000)
  height!: number;
}

export class AttachBlogMediaDto {
  @ApiProperty()
  @IsString()
  @Matches(BLOG_MEDIA_KEY_PATTERN)
  key!: string;

  @ApiProperty()
  @IsString()
  @Matches(BLOG_MEDIA_KEY_PATTERN)
  thumbKey!: string;

  @ApiProperty({ type: Dimensions })
  @ValidateNested()
  @Type(() => Dimensions)
  size!: Dimensions;

  @ApiProperty({ type: Dimensions })
  @ValidateNested()
  @Type(() => Dimensions)
  thumbSize!: Dimensions;

  @ApiPropertyOptional({ description: 'Varsayılan alt metin' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(BLOG_RULES.coverAltMax)
  alt?: string;
}

export class UpdateBlogMediaDto {
  @ApiProperty({ description: 'Alt metin; boşsa silinir' })
  @Transform(trim)
  @IsString()
  @MaxLength(BLOG_RULES.coverAltMax)
  alt!: string;
}

export class ListBlogMediaDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 24, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit = 24;
}
