import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, NotEquals } from 'class-validator';
import { CreditTransactionType } from '../../generated/prisma/enums.js';
import { PaginationDto } from '../../requests/dto/list-requests.dto.js';
import { CREDIT_SETTING_LIMITS as L, type CreditSettings } from '../credit-rules.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Değiştirilecek kredi ayarları; gönderilmeyen alan aynı kalır */
export class UpdateCreditSettingsDto implements Partial<CreditSettings> {
  @ApiPropertyOptional({ description: 'Kapalıyken teklif ücretsizdir' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '1 kredinin TL karşılığı (KDV dahil)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Kredi değeri bir sayı olmalı' })
  @Min(L.creditValueTry.min, { message: 'Kredi değeri 0’dan büyük olmalı' })
  @Max(L.creditValueTry.max)
  creditValueTry?: number;

  @ApiPropertyOptional({ description: 'Aynı il içindeki talebe teklif kredisi' })
  @IsOptional()
  @IsInt({ message: 'Şehir içi teklif kredisi tam sayı olmalı' })
  @Min(L.quoteCostLocal.min)
  @Max(L.quoteCostLocal.max)
  quoteCostLocal?: number;

  @ApiPropertyOptional({ description: 'İller arası talebe teklif kredisi' })
  @IsOptional()
  @IsInt({ message: 'Şehirler arası teklif kredisi tam sayı olmalı' })
  @Min(L.quoteCostIntercity.min)
  @Max(L.quoteCostIntercity.max)
  quoteCostIntercity?: number;

  @ApiPropertyOptional({ description: 'Onaylanan firmaya bir kez verilen kredi' })
  @IsOptional()
  @IsInt({ message: 'Hoş geldin kredisi tam sayı olmalı' })
  @Min(L.welcomeCredits.min)
  @Max(L.welcomeCredits.max)
  welcomeCredits?: number;

  @ApiPropertyOptional({ description: 'Seçimsiz süresi dolan talepte iade yüzdesi (0-100)' })
  @IsOptional()
  @IsInt({ message: 'İade oranı tam sayı olmalı' })
  @Min(L.expiredRefundPercent.min, { message: 'İade oranı 0 ile 100 arasında olmalı' })
  @Max(L.expiredRefundPercent.max, { message: 'İade oranı 0 ile 100 arasında olmalı' })
  expiredRefundPercent?: number;

  @ApiPropertyOptional({ description: 'Bakiye bunun altına inince firmaya uyarı' })
  @IsOptional()
  @IsInt({ message: 'Uyarı eşiği tam sayı olmalı' })
  @Min(L.lowBalanceThreshold.min)
  @Max(L.lowBalanceThreshold.max)
  lowBalanceThreshold?: number;
}

export class AdjustCreditDto {
  @ApiProperty({ description: 'Artı ekler, eksi düşer' })
  @IsInt({ message: 'Miktar tam sayı olmalı' })
  @NotEquals(0, { message: 'Miktar 0 olamaz' })
  @Min(-1_000_000)
  @Max(1_000_000)
  amount!: number;

  @ApiProperty({ description: 'Gerekçe; firmanın hareket listesinde görünür' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Gerekçe en az 3 karakter olmalı' })
  @MaxLength(500)
  note!: string;
}

export class CompanyCreditTransactionsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CreditTransactionType })
  @IsOptional()
  @IsEnum(CreditTransactionType)
  type?: CreditTransactionType;
}

export class AdminCreditTransactionsDto extends CompanyCreditTransactionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  companyId?: string;

  @ApiPropertyOptional({ description: 'Firma adında arar' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}
