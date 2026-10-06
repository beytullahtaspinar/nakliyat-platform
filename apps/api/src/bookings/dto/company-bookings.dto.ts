import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BookingStatus } from '../../generated/prisma/enums.js';
import { PaginationDto } from '../../requests/dto/list-requests.dto.js';

/** Firmanın iş ve müşteri listelerinde arama: müşteri adı ya da telefonu */
export class CompanySearchDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Müşteri adı ya da telefonunun bir parçası' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CompanyBookingsQueryDto extends CompanySearchDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
