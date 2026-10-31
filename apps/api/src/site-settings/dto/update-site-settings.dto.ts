import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { VERIFICATION_CODE_PATTERN } from '../site-settings.service.js';

/**
 * Yapıştırılan meta etiketinin tamamından (<meta name="..." content="KOD" />) kodu ayıklar; boş metin "kaldır" demek.
 */
export const extractCode = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  if (v === '') return null;
  return /content\s*=\s*["']([^"']*)["']/i.exec(v)?.[1].trim() ?? v;
};

const message = 'Doğrulama kodu yalnızca harf, rakam, - ve _ içerebilir (en fazla 100 karakter)';

/** Arama motoru doğrulama kodları; gönderilmeyen alan değişmez, boş gönderilen kaldırılır */
export class UpdateSiteSettingsDto {
  @ApiPropertyOptional({ nullable: true, description: 'Google Search Console: google-site-verification' })
  @IsOptional()
  @Transform(extractCode)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(VERIFICATION_CODE_PATTERN, { message })
  google?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Bing Webmaster Tools: msvalidate.01' })
  @IsOptional()
  @Transform(extractCode)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(VERIFICATION_CODE_PATTERN, { message })
  bing?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Yandex Webmaster: yandex-verification' })
  @IsOptional()
  @Transform(extractCode)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(VERIFICATION_CODE_PATTERN, { message })
  yandex?: string | null;
}
