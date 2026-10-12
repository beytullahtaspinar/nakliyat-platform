import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReason, ReportStatus, ReportTarget } from '../generated/prisma/enums.js';
import { PaginationDto } from '../requests/dto/list-requests.dto.js';

const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateReportDto {
  @ApiProperty({ enum: ReportTarget, description: 'MESSAGE: karşı tarafın mesajı, REVIEW: firmaya yazılan yorum, REVIEW_REPLY: firmanın yanıtı' })
  @IsEnum(ReportTarget, { message: 'Bildirilecek içerik türü geçersiz' })
  target!: ReportTarget;

  @ApiProperty({ description: 'Mesajın ya da değerlendirmenin kimliği' })
  @IsString()
  @MaxLength(191)
  targetId!: string;

  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason, { message: 'Bir neden seç' })
  reason!: ReportReason;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(500, { message: 'Açıklama en fazla 500 karakter olabilir' })
  note?: string;
}

export class ListReportsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReportStatus, default: ReportStatus.OPEN })
  @IsOptional()
  @IsEnum(ReportStatus)
  status: ReportStatus = ReportStatus.OPEN;
}

export class ResolveReportDto {
  @ApiProperty({ enum: [ReportStatus.RESOLVED, ReportStatus.DISMISSED], description: 'RESOLVED: haklı bulundu, DISMISSED: kural ihlali yok' })
  @IsIn([ReportStatus.RESOLVED, ReportStatus.DISMISSED])
  status!: 'RESOLVED' | 'DISMISSED';

  @ApiPropertyOptional({ description: 'İçeriği kaldır: mesaj metni silinir, yorum gizlenir, firma yanıtı silinir' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  removeContent?: boolean;

  @ApiPropertyOptional({ maxLength: 500, description: 'Yönetici notu; yorum gizlenirse gizleme gerekçesi olur' })
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(500)
  resolution?: string;
}
