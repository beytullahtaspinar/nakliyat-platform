import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { BankTransferStatus, CardPaymentStatus, CreditTransactionType } from '../../generated/prisma/enums.js';
import { DOCUMENT_RULES } from '../../media/company-document-rules.js';
import { STORAGE_KEY_PATTERN } from '../../media/media-rules.js';
import { PaginationDto } from '../../requests/dto/list-requests.dto.js';
import { CREDIT_SETTING_LIMITS as L, MAX_BANK_ACCOUNTS, normalizeIban, type BankAccount, type CreditSettings } from '../credit-rules.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const iban = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeIban(value) : value);

export class BankAccountDto implements BankAccount {
  @ApiProperty({ example: 'Ziraat Bankası' })
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Banka adı 2-80 karakter olmalı' })
  bank!: string;

  @ApiProperty({ description: 'Hesap sahibi (şirket unvanı)' })
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'Hesap sahibi 2-120 karakter olmalı' })
  holder!: string;

  @ApiProperty({ example: 'TR330006100519786457841326', description: 'Boşluklu yazılabilir' })
  @Transform(iban)
  @IsString()
  @Matches(/^TR\d{24}$/, { message: 'IBAN TR ile başlamalı ve 26 karakter olmalı' })
  iban!: string;
}

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

  @ApiPropertyOptional({ description: 'Kartla ödeme açık (iyzico anahtarları da gerekir)' })
  @IsOptional()
  @IsBoolean()
  cardEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Teklif güncellemeleri kredi düşsün mü (kapalı = ücretsiz)' })
  @IsOptional()
  @IsBoolean()
  chargeQuoteUpdates?: boolean;

  @ApiPropertyOptional({ description: 'Havale bildiriminde en az tutar (TL)' })
  @IsOptional()
  @IsInt({ message: 'En az yükleme tutarı tam sayı olmalı' })
  @Min(L.minTopupTry.min, { message: 'En az yükleme tutarı 1 TL ya da üstü olmalı' })
  @Max(L.minTopupTry.max)
  minTopupTry?: number;

  @ApiPropertyOptional({ type: [BankAccountDto], description: 'Havale/EFT hesapları; boş liste havale bildirimini kapatır' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BANK_ACCOUNTS, { message: `En fazla ${MAX_BANK_ACCOUNTS} banka hesabı eklenebilir` })
  @ValidateNested({ each: true })
  @Type(() => BankAccountDto)
  bankAccounts?: BankAccountDto[];
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

export class CreateTransferUploadDto {
  @ApiProperty({ enum: DOCUMENT_RULES.mimeTypes })
  @IsIn(DOCUMENT_RULES.mimeTypes, { message: 'Dekont PDF, JPG, PNG ya da WebP olmalı' })
  mimeType!: string;

  @ApiProperty({ description: 'Dosya boyutu (bayt)' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class TransferReceiptDto {
  @ApiProperty({ description: 'Yükleme adresiyle birlikte verilen anahtar' })
  @IsString()
  @Matches(STORAGE_KEY_PATTERN)
  key!: string;

  @ApiProperty({ example: 'dekont.pdf' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().slice(0, 200) : value))
  @IsString()
  @Length(1, 200)
  fileName!: string;
}

export class CreateBankTransferDto {
  @ApiProperty({ description: 'Gönderilen tutar (TL)', example: 1500 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Tutar en fazla iki ondalıklı bir sayı olmalı' })
  @Min(1, { message: 'Tutarı yazın' })
  @Max(1_000_000, { message: 'Tutar en fazla 1.000.000 TL olabilir' })
  amountTry!: number;

  @ApiProperty({ description: 'Gönderenin adı ya da unvanı (dekonttaki gibi)' })
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'Gönderen adı 2-120 karakter olmalı' })
  senderName!: string;

  @ApiProperty({ example: '2026-10-09' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Havale tarihi YYYY-AA-GG biçiminde olmalı' })
  transferDate!: string;

  @ApiProperty({ description: 'Gönderilen hesabın IBAN’ı' })
  @Transform(iban)
  @IsString()
  @Matches(/^TR\d{24}$/, { message: 'Gönderdiğiniz hesabı seçin' })
  iban!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ type: TransferReceiptDto, description: 'İsteğe bağlı dekont' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransferReceiptDto)
  receipt?: TransferReceiptDto;
}

export class ListBankTransfersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BankTransferStatus })
  @IsOptional()
  @IsEnum(BankTransferStatus)
  status?: BankTransferStatus;

  @ApiPropertyOptional({ description: 'Firma adı, havale kodu ya da gönderen adında arar' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ApproveBankTransferDto {
  @ApiPropertyOptional({ description: 'Hesaba geçen tutar; bildirilenden farklıysa yazılır' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Tutar en fazla iki ondalıklı bir sayı olmalı' })
  @Min(0.01, { message: 'Tutar 0’dan büyük olmalı' })
  @Max(1_000_000)
  amountTry?: number;
}

export class RejectBankTransferDto {
  @ApiProperty({ description: 'Firmaya gösterilir' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Gerekçe en az 3 karakter olmalı' })
  @MaxLength(500)
  reason!: string;
}

export class StartCardPaymentDto {
  @ApiProperty({ description: 'Ödenecek tutar (TL, KDV dahil)', example: 1000 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Tutar en fazla iki ondalıklı bir sayı olmalı' })
  @Min(1, { message: 'Tutarı yazın' })
  @Max(1_000_000)
  amountTry!: number;
}

export class ListCardPaymentsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CardPaymentStatus })
  @IsOptional()
  @IsEnum(CardPaymentStatus)
  status?: CardPaymentStatus;

  @ApiPropertyOptional({ description: 'Firma adında arar' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}
