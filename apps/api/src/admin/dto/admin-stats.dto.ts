import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';
import { STATS_PERIODS, type StatsPeriod } from '../admin-stats.js';

export class AdminStatsDto {
  @ApiPropertyOptional({ enum: STATS_PERIODS, default: 30, description: 'Bugünü de içeren son gün sayısı' })
  @Type(() => Number)
  @IsIn(STATS_PERIODS)
  days: StatsPeriod = 30;
}
