import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { VerificationStatus } from '../../generated/prisma/enums.js';
import { PaginationDto } from '../../requests/dto/list-requests.dto.js';

export class ListCompaniesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}

export class RejectCompanyDto {
  @ApiProperty({ example: 'K3 belgesinin süresi dolmuş, güncel belgeyi yükleyin.' })
  @IsString()
  @Length(5, 500)
  reason: string;
}
