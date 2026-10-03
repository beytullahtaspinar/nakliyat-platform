import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class CalendarRangeDto {
  @ApiProperty({ example: '2026-09-28', description: 'İlk gün (YYYY-AA-GG, Türkiye saati)' })
  @Matches(DAY, { message: 'from YYYY-AA-GG biçiminde olmalı' })
  from: string;

  @ApiProperty({ example: '2026-11-08', description: 'Son gün (dahil)' })
  @Matches(DAY, { message: 'to YYYY-AA-GG biçiminde olmalı' })
  to: string;
}
