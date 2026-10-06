import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, Matches } from 'class-validator';
import { QuoteStatus } from '../../generated/prisma/enums.js';
import { PaginationDto } from '../../requests/dto/list-requests.dto.js';

/** Firma panelinde gelen talepler süzgeci */
export class CompanyRequestsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['yes', 'no'], description: 'yes: teklif verdiklerim, no: henüz teklif vermediklerim' })
  @IsOptional()
  @IsIn(['yes', 'no'])
  quoted?: 'yes' | 'no';

  @ApiPropertyOptional({ example: '34', description: 'Çıkış ya da varış ili (plaka kodu)' })
  @IsOptional()
  @Matches(/^\d{2}$/, { message: 'city iki haneli plaka kodu olmalı' })
  city?: string;
}

export class CompanyQuotesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;
}
