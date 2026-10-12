import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CreateReportDto, ListReportsDto, ResolveReportDto } from './report.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Bildirimler: uygunsuz içerik')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Uygunsuz mesajı, yorumu ya da firma yanıtını yönetime bildirir */
  @Roles(UserRole.CUSTOMER, UserRole.COMPANY)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reports')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.create(user, dto);
  }

  /** Yönetim: bildirimler (varsayılan açık olanlar, en eskiden) */
  @Roles(UserRole.ADMIN)
  @Get('admin/reports')
  list(@Query() dto: ListReportsDto) {
    return this.reports.list(dto);
  }

  /** Yönetim: bildirimi kapatır, istenirse içeriği kaldırır */
  @Roles(UserRole.ADMIN)
  @Post('admin/reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.reports.resolve(admin.id, id, dto);
  }
}
