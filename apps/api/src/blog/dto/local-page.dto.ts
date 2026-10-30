import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { BLOG_MEDIA_KEY_PATTERN, BLOG_RULES } from '../blog-rules.js';
import { LOCAL_PAGE_RULES } from '../local-page-rules.js';
import { BlogFaqItemDto } from './blog.dto.js';

/** Boş metin "otomatik metni kullan" demek: null */
const emptyToNull = ({ value }: { value: unknown }) => {
  const v = typeof value === 'string' ? value.trim() : value;
  return v === '' ? null : v;
};

/** Bölge sayfası içeriği: her alan isteğe bağlı, boş bırakılanın yerine sayfanın otomatik metni kullanılır */
export class SaveLocalPageDto {
  @ApiPropertyOptional({ nullable: true, description: 'Arama sonucu başlığı' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.seoTitleMax, { message: `Google başlığı en fazla ${BLOG_RULES.seoTitleMax} karakter olabilir` })
  seoTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.seoDescriptionMax, { message: `Google açıklaması en fazla ${BLOG_RULES.seoDescriptionMax} karakter olabilir` })
  seoDescription?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Sayfa başlığı (H1)' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(LOCAL_PAGE_RULES.headingMax, { message: `Sayfa başlığı en fazla ${LOCAL_PAGE_RULES.headingMax} karakter olabilir` })
  heading?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(LOCAL_PAGE_RULES.introMax, { message: `Giriş metni en fazla ${LOCAL_PAGE_RULES.introMax} karakter olabilir` })
  intro?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Ek içerik (Markdown)' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.contentMax)
  content?: string | null;

  @ApiPropertyOptional({ type: [BlogFaqItemDto], description: 'Doluysa otomatik soruların yerine geçer' })
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
  @Matches(BLOG_MEDIA_KEY_PATTERN, { message: 'Kapak görseli geçersiz' })
  coverKey?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(BLOG_RULES.coverAltMax)
  coverAlt?: string | null;
}
